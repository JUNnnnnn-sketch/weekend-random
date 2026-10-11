#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把手工整理的两张表变成前端能用的 data/curated_places.js。

输入：
  data/places_curated.csv   玩法 -> 地点（232 条，带人气、季节、备注、来源）
  data/routes_curated.csv   玩法 -> 路线（17 条，带起点地铁站、途经、距离）
  tools/.cache/geo_*.json   坐标，由 tools/geocode_curated.py 查来

这批数据和 station_pois.js 不一样，不能一视同仁：

  有坐标的   —— 能算出离最近地铁站多远，正常进周末方案
  没坐标的   —— OSM 不收壁球馆、汤泉馆、采摘园、咖啡馆这类商业场所，
                实测壁球 0/7、匹克球 0/6、采摘 0/5、汤泉 1/10。
                这些仍然收录，只是界面上不说距离——「有这家店」比
                「什么都没有」强，但也不能假装知道它在哪。
  路线       —— 起点就是地铁站，不需要坐标。它占满时间，所以在周末方案里
                一条路线本身就是整个方案，不是其中一个环节。

河流（永定河、温榆河、潮白河、清河）刻意没有坐标：几十上百公里的河道，
给任何一个点都是编的。钓鱼那组就该只给河名。

用法：
    python tools/import_curated.py
    python tools/import_curated.py --check    # 只校验，有问题退出码 1
"""
import argparse
import csv
import json
import math
import os
import re
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache")
OUT = os.path.join(ROOT, "data", "curated_places.js")
BEIJING = timezone(timedelta(hours=8))

SEASON_CODE = {"全年": "all_year", "春": "spring", "夏": "summer",
               "秋": "autumn", "冬": "winter", "": "all_year"}


def read(name):
    with open(os.path.join(ROOT, "data", name), encoding="utf-8") as handle:
        return handle.read()


def read_csv(name):
    with open(os.path.join(ROOT, "data", name), encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def haversine_km(lat1, lon1, lat2, lon2):
    rad = math.radians
    dlat, dlon = rad(lat2 - lat1), rad(lon2 - lon1)
    h = math.sin(dlat / 2) ** 2 + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def all_station_names():
    """所有真实站名。坐标只覆盖 348/396，但路线用不着坐标，只要站名是真的。"""
    return set(re.findall(r'station_name: "([^"]+)"', read("subway.js")))


def load_stations():
    """站名 -> 坐标。subway.js 给站名和物理站 id，station_coordinates.js 给坐标。"""
    pid_to_name = {}
    for pid, name in re.findall(
            r'physical_station_id: "([^"]+)", station_name: "([^"]+)"', read("subway.js")):
        pid_to_name.setdefault(pid, name)
    stations = {}
    for pid, lat, lon in re.findall(
            r'"(P-[0-9a-f]+)": \{[^}]*?latitude: ([-\d.]+), longitude: ([-\d.]+)',
            read("station_coordinates.js")):
        name = pid_to_name.get(pid)
        if name:
            stations.setdefault(name, (float(lat), float(lon)))
    return stations


def cache_path(name):
    return os.path.join(CACHE, "geo_%s.json" % re.sub(r"[^\w一-鿿-]", "_", name))


def load_coords():
    coords = {}
    if not os.path.isdir(CACHE):
        return coords
    for row in read_csv("places_curated.csv"):
        name = row["地点名称"]
        if name in coords:
            continue
        path = cache_path(name)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as handle:
            hit = json.load(handle)
        if hit:
            coords[name] = hit
    return coords


def nearest(stations, lat, lon):
    best_name, best_km = None, None
    for name, (slat, slon) in stations.items():
        km = haversine_km(lat, lon, slat, slon)
        if best_km is None or km < best_km:
            best_name, best_km = name, km
    return best_name, best_km


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="只校验，不写文件")
    args = parser.parse_args()

    names = {e["name"] for e in json.loads(
        re.search(r"=\s*(\[.*\])\s*;", read("experiences.js"), re.S).group(1))}
    stations = load_stations()
    station_names = all_station_names()
    coords = load_coords()
    problems = []

    places, seen = [], set()
    for number, row in enumerate(read_csv("places_curated.csv"), start=2):
        experience, name = row["玩法"].strip(), row["地点名称"].strip()
        if not name:
            continue
        if experience not in names:
            problems.append("第 %d 行：玩法「%s」不在 experiences.js 里" % (number, experience))
            continue
        key = (experience, name)
        if key in seen:
            continue
        seen.add(key)

        record = {
            "id": "curated/%d" % number,
            "experience": experience,
            "name": name,
            "season": SEASON_CODE.get(row["季节"].strip(), "all_year"),
            "source": row["来源"].strip(),
        }
        popularity = row["人气"].strip().rstrip("%")
        if popularity:
            record["popularity"] = int(popularity)
        if row["备注"].strip():
            record["note"] = row["备注"].strip()

        hit = coords.get(name)
        if hit:
            record["latitude"] = hit["latitude"]
            record["longitude"] = hit["longitude"]
            record["source_url"] = ("https://www.openstreetmap.org/%s" % hit["osm_id"]
                                    if "/" in str(hit.get("osm_id", "")) else None)
            station, km = nearest(stations, hit["latitude"], hit["longitude"])
            if station:
                record["nearest_station"] = station
                record["nearest_km"] = round(km, 2)
            if not record["source_url"]:
                del record["source_url"]
        places.append(record)

    routes = []
    for number, row in enumerate(read_csv("routes_curated.csv"), start=2):
        experience = row["玩法"].strip()
        if experience not in names:
            problems.append("路线第 %d 行：玩法「%s」不在 experiences.js 里" % (number, experience))
            continue
        start = row["起点地铁站"].strip()
        if start and start not in station_names:
            problems.append("路线第 %d 行：起点「%s」查无此站" % (number, start))
            continue
        record = {
            "id": "route/%d" % number,
            "experience": experience,
            "name": row["路线名"].strip(),
            "stops": [s.strip() for s in re.split(r"→|->", row["途经"]) if s.strip()],
            "duration": row["建议时长"].strip(),
            "season": SEASON_CODE.get(row["季节"].strip(), "all_year"),
            "highlight": row["看点"].strip(),
            "source": row["来源"].strip(),
        }
        if start:
            record["start_station"] = start
        if row["距离"].strip():
            record["length"] = row["距离"].strip()
        routes.append(record)

    with_coords = sum(1 for p in places if "latitude" in p)
    print("地点 %d 条（%d 条有坐标，%d 条没有），路线 %d 条"
          % (len(places), with_coords, len(places) - with_coords, len(routes)))
    if problems:
        print("\n发现 %d 处问题：" % len(problems))
        for item in problems:
            print("  - %s" % item)
    if args.check:
        return 1 if problems else 0

    def dump(rows):
        return "\n".join("  %s," % json.dumps(r, ensure_ascii=False) for r in rows)

    header = [
        "/**",
        " * 手工整理的玩法地点表。对应 data/places_curated.csv 和 data/routes_curated.csv。",
        " *",
        " * 内容来自小红书「点点」AI 的聚合结果（每条都标了参考人数或篇数）和用户帖，",
        " * 由人工逐条转录。坐标来自 OpenStreetMap，经 Overpass 按名字查得。",
        " *",
        " * 和 station_pois.js 的区别：那边是按地理标签扫出来的场所，这边是按「想干什么」",
        " * 整理的，带人气百分比和季节——这两样 OSM 给不了。",
        " *",
        " * 没有坐标的条目是刻意保留的：OSM 不收壁球馆、汤泉馆、采摘园、咖啡馆这类",
        " * 商业场所（实测壁球 0/7、匹克球 0/6、采摘 0/5、汤泉 1/10）。有这家店的名字",
        " * 比什么都没有强，但不能假装知道它在哪，所以界面上不说距离。",
        " * 河流（永定河、温榆河、潮白河、清河）同样没有坐标：几十上百公里的河道，",
        " * 给任何一个点都是编的。",
        " *",
        " * 路线不需要坐标——它的起点就是地铁站。路线占满时间，在周末方案里",
        " * 一条路线本身就是整个方案，不是其中一个环节。",
        " *",
        " * 地点 %d 条（%d 条有坐标），路线 %d 条。" % (len(places), with_coords, len(routes)),
        " * 生成时间：%s" % datetime.now(BEIJING).isoformat(timespec="seconds"),
        " * 本文件由 tools/import_curated.py 生成，要改请改那两张 CSV。",
        " */",
        "export const curatedPlaces = [",
        dump(places),
        "];",
        "",
        "export const curatedRoutes = [",
        dump(routes),
        "];",
        "",
    ]
    with open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(header))
    print("已写出：%s" % OUT)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
