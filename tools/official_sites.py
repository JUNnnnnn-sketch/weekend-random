#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""手工填的官网表：data/official_sites.csv。

为什么要人来填：OSM 的 website 标签只有一百多条，Wikidata 的 P856 又只覆盖
故宫、天坛这类名气够大的机构。剩下几百个地方——小剧场、社区美术馆、郊区营地、
汤泉馆——机器查不到，但人搜一下就有。

这张表按名字生效，同时管两边：
  data/station_pois.js     （tools/fetch_station_pois.py 生成）
  data/curated_places.js   （tools/import_curated.py 生成）

手填的优先级最高：它是人刚刚核对过的，比标签里躺了几年的旧网址可信。
"""
import csv
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data", "official_sites.csv")
FIXES_PATH = os.path.join(ROOT, "data", "name_fixes.csv")
COLUMNS = ["名称", "类型", "出处", "链接类型", "官网"]


def load_rows():
    """读出整张表，保持行序。表不存在就当空表。

    分隔符不写死：开头那行 sep=, 是给 Excel 看的（见 write_rows），这里要跳过；
    而从 Excel 另存回来的表可能是分号分隔的——Windows 中文版的「列表分隔符」
    默认就是分号。两种都认，省得一存一读就坏。
    """
    return [row for row in read_table(CSV_PATH) if (row.get("名称") or "").strip()]


def load_sites():
    """名称 -> 官网。只收填了的，空着的当没这条。"""
    sites = {}
    for row in load_rows():
        url = (row.get("官网") or "").strip()
        if url:
            sites[(row.get("名称") or "").strip()] = url
    return sites


def read_table(path):
    """读一张可能带 Excel sep= 头、可能是分号分隔的 CSV。"""
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8-sig") as handle:
        lines = handle.read().splitlines()
    delimiter = ","
    if lines and lines[0].lower().startswith("sep="):
        delimiter = lines[0][4:].strip() or ","
        lines = lines[1:]
    elif lines and lines[0].count(";") > lines[0].count(","):
        delimiter = ";"
    return list(csv.DictReader(lines, delimiter=delimiter))


def load_name_fixes():
    """OSM 名字的人工更正表 data/name_fixes.csv。

    原名 -> 改成。「改成」留空表示这条根本不该出现在推荐里（快闪展览、
    顶着别人名字的小展室），整条丢掉。

    为什么要这张表而不是直接改生成出来的 js：那个文件是重跑脚本生成的，
    手改一次下次就没了。也不去改 OSM —— 那是别人的地图，不是我们的数据。
    """
    fixes = {}
    for row in read_table(FIXES_PATH):
        old = (row.get("原名") or "").strip()
        if old:
            fixes[old] = (row.get("改成") or "").strip()
    return fixes


def write_rows(rows):
    # 两处迁就 Excel，都是实际撞上的：
    #   BOM —— 中文 Windows 上没 BOM 的 UTF-8 会被按 GBK 解，中文全是乱码。
    #   sep=, —— Excel 按系统「列表分隔符」分列，中文版默认是分号，
    #            于是逗号分隔的表会整行挤进 A 列。开头这一行能让它改用逗号。
    # 这一行不是 CSV 标准的一部分，所以 load_rows 要跳过它。
    with open(CSV_PATH, "w", encoding="utf-8-sig", newline="") as handle:
        handle.write("sep=,\n")
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in COLUMNS})
