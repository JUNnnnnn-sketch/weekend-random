#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把手工整理的地点表（data/places_manual.csv）转成 data/manual_places.js。

这批地点 OpenStreetMap 里查不到或者标注不全——看夜景、胡同夜游、City Walk
这类玩法的价值全在「具体是哪儿」，但 OSM 不收「适合看夜景的地方」这种信息。
所以只能手工填，来源写清楚。

坐标不手工填，也不猜：填「最近地铁站」，坐标从 data/station_coordinates.js
取那一站的。周末方案本来就是按地铁站锚定的，站级精度够用；
写一个编出来的经纬度反而是假数据。

用法：
    python tools/import_manual_places.py           # 校验并生成
    python tools/import_manual_places.py --check   # 只校验，有问题退出码 1
"""
import argparse
import csv
import io
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data", "places_manual.csv")
OUT_PATH = os.path.join(ROOT, "data", "manual_places.js")
BEIJING = timezone(timedelta(hours=8))

COLUMNS = ["分组", "玩法", "地点名称", "最近地铁站", "所在区", "一句话推荐", "来源链接"]


def read(name):
    return io.open(os.path.join(ROOT, "data", name), encoding="utf-8").read()


def load_reference():
    """玩法名、站名 -> 物理站 id、物理站 id -> 坐标。

    subway.js 和 station_coordinates.js 是 JS 字面量（键没加引号），json 解析不了，
    所以按正则取需要的那几个字段——比引一个 JS 解析器划算。
    """
    names = {e["name"] for e in
             json.loads(re.search(r"=\s*(\[.*\])\s*;", read("experiences.js"), re.S).group(1))}

    stations = {}
    for pid, station_name in re.findall(
            r'physical_station_id:\s*"([^"]+)",\s*station_name:\s*"([^"]+)"', read("subway.js")):
        stations.setdefault(station_name, pid)

    coords = {}
    for pid, lat, lon in re.findall(
            r'"(P-[0-9a-f]+)":\s*\{[^}]*?latitude:\s*([-\d.]+),\s*longitude:\s*([-\d.]+)',
            read("station_coordinates.js")):
        coords[pid] = {"latitude": float(lat), "longitude": float(lon)}

    return names, stations, coords


def clean(value):
    return (value or "").strip()


def parse_rows(names, stations, coords):
    rows, problems = [], []
    with io.open(CSV_PATH, encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = [c for c in COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            problems.append("表头少了这些列：%s" % "、".join(missing))
            return rows, problems

        for number, raw in enumerate(reader, start=2):
            experience = clean(raw.get("玩法"))
            place = clean(raw.get("地点名称"))
            if not place:
                continue                                  # 还没填的空行，跳过
            if clean(raw.get("分组")).startswith("示例"):
                continue                                  # 示例行不入库

            where = "第 %d 行「%s」" % (number, place)
            if experience not in names:
                problems.append("%s：玩法「%s」在 data/experiences.js 里没有，"
                                "八成是名字写得不一样" % (where, experience))
                continue

            source = clean(raw.get("来源链接"))
            if not source:
                problems.append("%s：没填来源链接。每条都要能查到出处，"
                                "宁可不收也不编" % where)
                continue

            station = clean(raw.get("最近地铁站"))
            latitude = longitude = None
            if station:
                if station not in stations:
                    problems.append("%s：地铁站「%s」查无此站，"
                                    "对一下 data/subway.js 里的写法" % (where, station))
                    continue
                point = coords.get(stations[station])
                if point:
                    latitude = point["latitude"]
                    longitude = point["longitude"]
                else:
                    problems.append("%s：「%s」站还没有坐标（348/396 已覆盖），"
                                    "这条会收进来但周末方案暂时用不上" % (where, station))

            rows.append({
                "id": "manual/%d" % number,
                "experience": experience,
                "name": place,
                "station": station or None,
                "district": clean(raw.get("所在区")) or None,
                "note": clean(raw.get("一句话推荐")) or None,
                "source_url": source,
                "latitude": latitude,
                "longitude": longitude,
            })
    return rows, problems


def render(rows):
    by_experience = {}
    for row in rows:
        by_experience.setdefault(row["experience"], []).append(row)

    header = [
        "/**",
        " * 手工整理的地点表，对应 data/places_manual.csv。",
        " *",
        " * 为什么要手工：看夜景、胡同夜游、City Walk 这类玩法，价值全在「具体是哪儿」，",
        " * 但 OpenStreetMap 不收「适合看夜景的地方」这种判断，查不到就是查不到。",
        " *",
        " * 坐标不是这些地点本身的坐标，是它「最近地铁站」的坐标——周末方案按站锚定，",
        " * 站级精度够用，编一个精确到门口的经纬度反而是假数据。所以界面上只说",
        " * 「XX站附近」，不报步行多少米。",
        " *",
        " * 每条都带 source_url，来源存疑的不收。",
        " *",
        " * 共 %d 条，覆盖 %d 个玩法：" % (len(rows), len(by_experience)),
    ]
    for name in sorted(by_experience, key=lambda k: -len(by_experience[k])):
        header.append(" *   %s  %d" % (name, len(by_experience[name])))
    header += [
        " *",
        " * 生成时间：%s" % datetime.now(BEIJING).isoformat(timespec="seconds"),
        " * 本文件由 tools/import_manual_places.py 生成，要改请改那张 CSV。",
        " */",
        "export const manualPlaces = [",
    ]

    body = []
    for row in rows:
        fields = ['id: %s' % json.dumps(row["id"], ensure_ascii=False),
                  'experience: %s' % json.dumps(row["experience"], ensure_ascii=False),
                  'name: %s' % json.dumps(row["name"], ensure_ascii=False)]
        for key in ("station", "district", "note"):
            if row[key]:
                fields.append("%s: %s" % (key, json.dumps(row[key], ensure_ascii=False)))
        if row["latitude"] is not None:
            fields.append("latitude: %s" % row["latitude"])
            fields.append("longitude: %s" % row["longitude"])
        fields.append('source_url: %s' % json.dumps(row["source_url"], ensure_ascii=False))
        body.append("  { %s }," % ", ".join(fields))

    return "\n".join(header + body + ["];", ""])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="只校验，不写文件")
    args = parser.parse_args()

    names, stations, coords = load_reference()
    rows, problems = parse_rows(names, stations, coords)

    if problems:
        print("发现 %d 处问题：" % len(problems))
        for item in problems:
            print("  - %s" % item)
        print("")

    print("可用 %d 条，覆盖 %d 个玩法。" % (rows and len(rows) or 0,
                                           len({r["experience"] for r in rows})))
    if not rows:
        print("表还是空的——填几行再跑。")
        return 1 if problems else 0

    if args.check:
        return 1 if problems else 0

    io.open(OUT_PATH, "w", encoding="utf-8", newline="\n").write(render(rows))
    print("已写入 data/manual_places.js")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
