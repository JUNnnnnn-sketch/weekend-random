#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 Wikidata 查官方网站（P856），补 OSM 没填的那部分。

为什么要这一步：OSM 里自己填了 website 的只有一百多条，但带 wikidata 标签的
有四百多。Wikidata 上「官方网站」是个标准属性，查一次就能把故宫、天坛、
国家大剧院这类大地方的官网补齐——界面上「点名字进官网」才立得住。

礼貌用法：
  - 一次最多问 50 个实体（Wikidata API 自己的上限）
  - 请求之间等 RATE_SECONDS 秒
  - 失败不重试，结果写缓存，下次重跑只补没查的

输入：tools/.cache/wikidata_ids.json（由 fetch_station_pois.py 生成）
输出：tools/.cache/official_sites.json  {"Q123": "https://..."}

许可：Wikidata 的数据是 CC0，可以直接用。
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache")
IDS = os.path.join(CACHE, "wikidata_ids.json")
OUT = os.path.join(CACHE, "official_sites.json")
API = "https://www.wikidata.org/w/api.php"
UA = "weekend-random/1.0 (personal hobby project; https://github.com/JUNnnnnn-sketch/weekend-random)"
BATCH = 50
RATE_SECONDS = 2


def load(path, fallback):
    if not os.path.exists(path):
        return fallback
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def fetch(ids):
    params = {
        "action": "wbgetentities",
        "ids": "|".join(ids),
        "props": "claims",
        "format": "json",
    }
    req = urllib.request.Request("%s?%s" % (API, urllib.parse.urlencode(params)),
                                 headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        print("   ✗ HTTP %s：%s" % (exc.code, exc.reason))
    except Exception as exc:                                   # noqa: BLE001
        print("   ✗ 请求失败：%s" % exc)
    return None


def official_site(entity):
    """P856 = 官方网站。可能有多个值（中英文站），取第一个。"""
    for claim in (entity.get("claims") or {}).get("P856", []):
        value = (claim.get("mainsnak") or {}).get("datavalue", {}).get("value")
        if isinstance(value, str) and value.startswith("http"):
            return value
    return None


def main():
    ids = load(IDS, [])
    if not ids:
        print("没有 wikidata id——先跑一次 tools/fetch_station_pois.py")
        return 1
    done = load(OUT, {})
    todo = [i for i in ids if i not in done]
    print("共 %d 个实体，已查 %d（命中官网 %d），还差 %d\n"
          % (len(ids), len(done), sum(1 for v in done.values() if v), len(todo)))
    if not todo:
        return 0

    batches = [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)]
    for index, batch in enumerate(batches, 1):
        print("第 %d/%d 批（%d 个）" % (index, len(batches), len(batch)))
        payload = fetch(batch)
        if payload is None:
            print("   这批跳过，下次重跑")
            time.sleep(RATE_SECONDS)
            continue
        entities = payload.get("entities") or {}
        hit = 0
        for key in batch:
            site = official_site(entities.get(key) or {})
            done[key] = site          # 查无也记下来，省得下次重查
            if site:
                hit += 1
        print("   命中官网 %d/%d" % (hit, len(batch)))
        with open(OUT, "w", encoding="utf-8") as handle:
            json.dump(done, handle, ensure_ascii=False, indent=0, sort_keys=True)
        if index < len(batches):
            time.sleep(RATE_SECONDS)

    print("\n共解析出官网 %d 个。重跑 fetch_station_pois.py --rebuild 写进数据。"
          % sum(1 for v in done.values() if v))
    return 0


if __name__ == "__main__":
    sys.exit(main())
