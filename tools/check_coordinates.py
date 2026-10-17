#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""拿 Wikidata 的坐标核对 OSM 的坐标，把对不上的列出来。

为什么要核：我们按「离地铁站多远」推荐，1.2 公里就是一个站的覆盖半径。
一个 POI 的坐标要是错了一公里，它就会被挂到错的站上——用户按图索骥
走到地方发现不是那儿。北平图书馆旧址就是这么发现的：OSM 和 Wikidata
差 1.2 公里。

能核的只有带 wikidata 标签的那部分（九百多条里两百来条）。没有标签的
核不了，这张单子不代表别的 POI 就是对的。

不做的事：
  - 不改坐标。两个数据源打架的时候，没有第三方能裁决，猜一个等于编一个。
    这张单子是给人看的，不是给机器自动修的。
  - 不判定谁对谁错。Wikidata 的点也可能是随手标的。

用法：
    python tools/check_coordinates.py              # 联网查 Wikidata，带缓存
    python tools/check_coordinates.py --offline    # 只用缓存

输出：tools/.cache/wikidata_coords.json（缓存）+ 屏幕上的清单

许可：Wikidata 是 CC0；OSM 是 ODbL 1.0。
"""
import argparse
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache")
COORDS = os.path.join(CACHE, "wikidata_coords.json")
API = "https://www.wikidata.org/w/api.php"
UA = "weekend-random/1.0 (personal hobby project; https://github.com/JUNnnnnn-sketch/weekend-random)"
BATCH = 50
RATE_SECONDS = 2
# 差多少算「对不上」。1.2 公里是推荐半径，500 米已经足以把一个地方
# 推到隔壁站去，所以用它当门槛。
THRESHOLD_M = 500


def haversine_m(lat1, lon1, lat2, lon2):
    rad = math.radians
    dlat, dlon = rad(lat2 - lat1), rad(lon2 - lon1)
    h = (math.sin(dlat / 2) ** 2
         + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.sin(dlon / 2) ** 2)
    return 6371000 * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def load(path, fallback):
    if not os.path.exists(path):
        return fallback
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def osm_points():
    """从缓存的 Overpass 原始响应里，取出「带 wikidata 标签」的要素。"""
    seen = {}
    for name in sorted(os.listdir(CACHE)):
        if not name.startswith("poi_"):
            continue
        for element in load(os.path.join(CACHE, name), {}).get("elements", []):
            tags = element.get("tags") or {}
            qid, label = tags.get("wikidata"), tags.get("name")
            if not qid or not label:
                continue
            lat, lon = element.get("lat"), element.get("lon")
            if lat is None and element.get("center"):
                lat, lon = element["center"]["lat"], element["center"]["lon"]
            if lat is None:
                continue
            seen.setdefault(qid, (label, lat, lon,
                                  "%s/%s" % (element["type"], element["id"])))
    return seen


def fetch(ids):
    params = {"action": "wbgetentities", "ids": "|".join(ids),
              "props": "claims", "format": "json"}
    request = urllib.request.Request("%s?%s" % (API, urllib.parse.urlencode(params)),
                                     headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:                                   # noqa: BLE001
        print("   ✗ 这批没取到：%s" % exc)
        return None


def coordinate(entity):
    """P625 = 地理坐标。"""
    for claim in (entity.get("claims") or {}).get("P625", []):
        value = (claim.get("mainsnak") or {}).get("datavalue", {}).get("value")
        if isinstance(value, dict) and "latitude" in value:
            return [value["latitude"], value["longitude"]]
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="只用缓存，不联网")
    args = parser.parse_args()

    points = osm_points()
    print("OSM 里带 wikidata 标签的 POI：%d 条" % len(points))
    known = load(COORDS, {})
    todo = [qid for qid in points if qid not in known]

    if todo and not args.offline:
        batches = [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)]
        print("还要查 %d 个实体，分 %d 批（每批间隔 %ds）" % (len(todo), len(batches), RATE_SECONDS))
        for index, batch in enumerate(batches, 1):
            payload = fetch(batch)
            if payload is not None:
                entities = payload.get("entities") or {}
                for qid in batch:
                    known[qid] = coordinate(entities.get(qid) or {})
                with open(COORDS, "w", encoding="utf-8") as handle:
                    json.dump(known, handle, ensure_ascii=False, sort_keys=True)
            print("   第 %d/%d 批完成" % (index, len(batches)))
            if index < len(batches):
                time.sleep(RATE_SECONDS)
    elif todo:
        print("缓存里缺 %d 个，--offline 模式下跳过" % len(todo))

    rows, compared, no_wd = [], 0, 0
    for qid, (label, lat, lon, osm_id) in points.items():
        wd = known.get(qid)
        if not wd:
            no_wd += 1
            continue
        compared += 1
        metres = haversine_m(lat, lon, wd[0], wd[1])
        if metres > THRESHOLD_M:
            rows.append((metres, label, osm_id, qid, (lat, lon), tuple(wd)))

    rows.sort(reverse=True)
    print()
    print("能对照的 %d 条（Wikidata 没坐标的 %d 条跳过），超过 %d 米的有 %d 条：\n"
          % (compared, no_wd, THRESHOLD_M, len(rows)))
    for metres, label, osm_id, qid, osm, wd in rows:
        print("  %7.0f m  %-22s  OSM %.5f,%.5f   WD %.5f,%.5f   %s  %s"
              % (metres, label, osm[0], osm[1], wd[0], wd[1], osm_id, qid))
    print()
    print("坐标一律不改——两边打架时没有第三方能裁决，猜一个等于编一个。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
