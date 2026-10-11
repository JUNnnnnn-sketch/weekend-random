#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""给 data/places_curated.csv 里的地点查 OpenStreetMap 坐标。

这批地点是人工从小红书整理的，只有名字。要进周末方案就得有坐标——
不然算不出离哪个地铁站多远，也判断不了是城区还是京郊。

礼貌用法（和 fetch_station_pois.py 同一套规矩）：
  - 串行，每次请求之间等 RATE_SECONDS 秒
  - 一次只查一批（BATCH 个名字），不把 232 个塞进一个查询
  - 遇到 429 立即停止，不重试、不换节点、不提速
  - 结果缓存在 tools/.cache/geo_*.json，中断后重跑只补没查过的

查不到很正常：「香八拉」「潮创西四」这类是路线名，OSM 里没有对应实体。
查不到就留空，不猜坐标。

用法：
    python tools/geocode_curated.py              # 接着上次的查
    python tools/geocode_curated.py --dry-run    # 只看还差多少，不联网
    python tools/geocode_curated.py --limit 3    # 只跑 3 批就停
"""
import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data", "places_curated.csv")
CACHE = os.path.join(ROOT, "tools", ".cache")
ENDPOINT = "https://overpass-api.de/api/interpreter"
UA = "weekend-random/1.0 (personal hobby project; OSM data via Overpass)"

# 北京全域，比日常抓取的框大——这批地点有不少在远郊
BBOX = "39.40,115.40,41.10,117.50"
# 一个查询里塞几个名字。10 个在大多数情况下没问题，但遇到「清河」「永定河」
# 「温榆河」「潮白河」这种大河名，正则会命中几千段河道，响应体积能把连接撑爆
# （实测整轮 IncompleteRead / Remote end closed）。剩下难啃的用 --batch 3 慢慢磨。
BATCH = 10
RATE_SECONDS = 3    # 两次请求之间等多久

# 这些 OSM 标签下的实体才算数。不限定的话会 match 到一堆公交站和路名。
#
# 刻意不含 building：带名字的建筑在北京有几十万个，加上它整个查询会重到
# Overpass 直接断连（实测两批全部 "Remote end closed connection"）。
# 想找的东西——山、公园、景区、场馆、店——都落在下面这些标签里。
KINDS = ["natural", "leisure", "tourism", "amenity", "historic", "shop",
         "landuse", "waterway", "sport"]


def norm(name):
    """查询用的名字：去掉「漂流」「采摘园」这类后缀前的限定没必要，
    但要去掉正则里的特殊字符，否则 Overpass 的 regex 会炸。"""
    return re.sub(r"[.*+?^${}()|\[\]\\/]", "", name).strip()


def build_query(names):
    pattern = "|".join(norm(n) for n in names if norm(n))
    parts = "".join('  nwr["name"~"%s"]["%s"](%s);\n' % (pattern, k, BBOX) for k in KINDS)
    return "[out:json][timeout:180];\n(\n%s);\nout center tags;\n" % parts


def fetch(names):
    body = build_query(names).encode("utf-8")
    req = urllib.request.Request(ENDPOINT, data=body, headers={"User-Agent": UA})
    try:
        return urllib.request.urlopen(req, timeout=240).read()
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            print("   ⛔ 429 限流——按规矩停下，不重试。过一阵再跑，已查到的都在缓存里。")
            sys.exit(2)
        print("   ✗ HTTP %s：%s" % (exc.code, exc.reason))
        return None
    except Exception as exc:                                   # noqa: BLE001
        print("   ✗ 请求失败：%s" % exc)
        return None


def pick(elements, name):
    """从返回结果里挑最像的一条：名字完全相同 > 名字包含 > 没有。"""
    want = norm(name)
    exact, partial = [], []
    for el in elements:
        tags = el.get("tags") or {}
        got = (tags.get("name") or "").strip()
        lat, lon = el.get("lat"), el.get("lon")
        if lat is None and el.get("center"):
            lat, lon = el["center"]["lat"], el["center"]["lon"]
        if not got or lat is None:
            continue
        kind = next(("%s=%s" % (k, tags[k]) for k in KINDS if k in tags), "?")
        row = {"osm_name": got, "kind": kind, "latitude": round(lat, 6),
               "longitude": round(lon, 6), "osm_id": "%s/%s" % (el["type"], el["id"])}
        if got == want:
            exact.append(row)
        elif want in got or got in want:
            partial.append(row)
    return (exact or partial or [None])[0]


# 查 Overpass 之前，先在自己已有的 data/station_pois.js 里对一遍——那本来就是
# 从 OSM 抓的，同名就是同一条，白跑一次网络没必要。
#
# 只认完全同名。试过「包含即算」，立刻出错：「清河」匹配到了清河万象汇（商场），
# 「永定河」匹配到了北京冬奥公园（河岸上的一个公园）。宁可不给，不错给。
#
# ALIAS 是少数几个「场馆在某个大地方里面」的情况：朝阳公园冰场确实就在朝阳公园
# 里，用公园的坐标是对的，不是猜的。
ALIAS = {
    "朝阳公园冰场": "朝阳公园",
    "朝阳公园匹克球场": "朝阳公园",
    "朝阳大悦城冠军冰场": "朝阳大悦城",
}


def load_known_pois():
    path = os.path.join(ROOT, "data", "station_pois.js")
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    known = {}
    for osm, name, lat, lon in re.findall(
            r'id: "([^"]+)", name: "([^"]+)", category: "[^"]+", subtype: "[^"]+",'
            r' latitude: ([-\d.]+), longitude: ([-\d.]+)', text):
        known.setdefault(name, {"osm_name": name, "kind": "station_pois",
                                "latitude": float(lat), "longitude": float(lon),
                                "osm_id": osm})
    return known


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="只统计，不联网")
    parser.add_argument("--limit", type=int, default=0, help="最多跑几批")
    parser.add_argument("--batch", type=int, default=BATCH, help="一批几个名字（难啃的调小）")
    args = parser.parse_args()

    os.makedirs(CACHE, exist_ok=True)
    rows = list(csv.DictReader(open(CSV_PATH, encoding="utf-8")))
    names = sorted({r["地点名称"] for r in rows})

    known = load_known_pois()
    found, todo, reused = {}, [], 0
    for name in names:
        path = os.path.join(CACHE, "geo_%s.json" % re.sub(r"[^\w一-鿿-]", "_", name))
        if os.path.exists(path):
            found[name] = json.load(open(path, encoding="utf-8"))
            continue
        local = known.get(name) or known.get(ALIAS.get(name, ""))
        if local:
            json.dump(local, open(path, "w", encoding="utf-8"), ensure_ascii=False)
            found[name] = local
            reused += 1
            continue
        todo.append((name, path))
    if reused:
        print("从已有的 station_pois.js 里直接对上 %d 个，省掉这几次请求" % reused)

    hit = sum(1 for v in found.values() if v)
    print("共 %d 个不重名的地点：已查 %d（命中 %d / 查无 %d），还差 %d\n"
          % (len(names), len(found), hit, len(found) - hit, len(todo)))
    if args.dry_run or not todo:
        return 0

    size = max(1, args.batch)
    batches = [todo[i:i + size] for i in range(0, len(todo), size)]
    if args.limit:
        batches = batches[:args.limit]
    print("要跑 %d 批，每批 %d 个，间隔 %d 秒——预计 %d 分钟\n"
          % (len(batches), BATCH, RATE_SECONDS, (len(batches) * (RATE_SECONDS + 12)) // 60 + 1))

    for index, batch in enumerate(batches, 1):
        print("第 %d/%d 批：%s" % (index, len(batches), "、".join(n for n, _ in batch)))
        raw = fetch([n for n, _ in batch])
        if raw is None:
            print("   这批跳过，下次重跑")
            time.sleep(RATE_SECONDS)
            continue
        elements = json.loads(raw.decode("utf-8")).get("elements", [])
        got = 0
        for name, path in batch:
            best = pick(elements, name)
            json.dump(best, open(path, "w", encoding="utf-8"), ensure_ascii=False)
            if best:
                got += 1
        print("   返回 %d 个元素，命中 %d/%d" % (len(elements), got, len(batch)))
        if index < len(batches):
            time.sleep(RATE_SECONDS)

    print("\n跑完这一轮。再运行一次会接着查剩下的。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
