#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成/刷新 data/official_sites.csv —— 一张待填的官网表。

用法（项目根目录）：
    python tools/build_official_sites_table.py

已经填好的行原样保留，只补新出现的地方、删掉数据里已经没有的。
所以数据刷新之后随时可以重跑，不会把填过的东西冲掉。

「链接类型」记这条链接是哪一档：官网 > 票务 > 公众号 > 官方条目。
找不到真官网时，官方票务系统、公众号、北京旅游网/文物局的条目都可以挂——
「能查到开放时间和怎么订票」比「什么都没有」有用。百度百科、携程、马蜂窝
不挂：那是用户编的和卖票的，不是这地方自己说话。

收哪些：
  手工表（places_curated.csv）里全部没官网的，按人气从高到低——
    这批是你自己挑的，机器基本查不到（营地、汤泉馆、球馆、采摘园）。
  地铁周边（station_pois.js）里「机构类」且没官网的，按类型排序——
    博物馆、剧场、美术馆、公园这些是有官网的，只是 OSM 没填。

不收哪些：酒吧、影院、KTV、台球、卡丁车、餐厅、街区商圈、攀岩馆……
  这些地方本来就该看大众点评：官网即便有，也不如点评上的营业时间和照片有用。
  界面上没官网的名字就是跳点评，所以这几类根本不需要这一列。
"""
import csv
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from official_sites import load_rows, write_rows   # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 排在前面的先填。顺序就是优先级：从上往下填，填到哪算哪。
SUBTYPE_ORDER = [
    "历史博物馆", "综合博物馆", "科技博物馆", "艺术博物馆", "自然博物馆",
    "民俗博物馆", "军事博物馆", "工业博物馆", "食物博物馆", "汽车博物馆",
    "冷门 / 奇趣博物馆", "规划展览馆",
    "美术馆 / 画廊", "艺术中心", "剧场",
    "公园", "园林", "动物园", "水族馆", "自然保护区",
    "地标 / 古迹", "古迹", "遗址", "故居 / 纪念馆", "寺庙 / 教堂", "古寺",
    "图书馆", "体育场馆",
]
RANK = {name: index for index, name in enumerate(SUBTYPE_ORDER)}


def read(path):
    return io.open(os.path.join(ROOT, path), encoding="utf-8").read()


def osm_candidates():
    rows = []
    for chunk in re.findall(r"\{ id: .*?\},\n", read("data/station_pois.js")):
        if "website:" in chunk:
            continue
        name = re.search(r'name: "(.*?)"', chunk)
        subtype = re.search(r'subtype: "(.*?)"', chunk)
        if not name or not subtype or subtype.group(1) not in RANK:
            continue
        rows.append((RANK[subtype.group(1)], name.group(1),
                     {"名称": name.group(1), "类型": subtype.group(1),
                      "出处": "地铁周边", "链接类型": ""}))
    rows.sort(key=lambda r: (r[0], r[1]))
    return [r[2] for r in rows]


def curated_candidates():
    rows = []
    with io.open(os.path.join(ROOT, "data", "places_curated.csv"), encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            name = (row.get("地点名称") or "").strip()
            if not name or (row.get("官网") or "").strip():
                continue
            popularity = (row.get("人气") or "").strip().rstrip("%")
            rows.append((-int(popularity) if popularity.isdigit() else 0, name,
                         {"名称": name, "类型": (row.get("玩法") or "").strip(),
                          "出处": "手工表", "链接类型": ""}))
    rows.sort(key=lambda r: (r[0], r[1]))
    return [r[2] for r in rows]


def main():
    # 填过的行必须原样留着。候选名单是「还缺官网的地方」，而一条填好的记录
    # 正好就不缺了——照着候选名单重写，等于把刚填的成果自己删掉（真干过一次）。
    # 这张表是记账的地方，不是待办清单的快照。
    done = {}
    for row in load_rows():
        if (row.get("官网") or "").strip():
            done[(row.get("名称") or "").strip()] = row

    seen, out = set(), []
    for row in curated_candidates() + osm_candidates():
        if row["名称"] in seen:
            continue
        seen.add(row["名称"])
        out.append(done.get(row["名称"]) or dict(row, 官网=""))

    # 填过、但这一轮候选名单里没有的（正因为填了官网才落选），补回表尾
    leftover = [row for name, row in done.items() if name not in seen]
    out.extend(leftover)

    kept = sum(1 for row in out if (row.get("官网") or "").strip())
    write_rows(out)
    print("已写出 data/official_sites.csv：%d 行，其中 %d 行已经填好" % (len(out), kept))
    print("从上往下填「官网」那一列，填多少算多少。填完跑：")
    print("    python tools/import_curated.py")
    print("    python tools/fetch_station_pois.py --rebuild")


if __name__ == "__main__":
    sys.exit(main())
