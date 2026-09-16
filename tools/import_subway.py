# -*- coding: utf-8 -*-
"""把 beijing_subway.xlsx 转换成 data/subway.js。

用法（在项目根目录）：
    python tools/import_subway.py            # 重新生成 data/subway.js
    python tools/import_subway.py --check    # 只校验，不写文件；内容有变化则退出码为 1
    python tools/import_subway.py --xlsx 别的.xlsx --out 别的.js

输入：beijing_subway.xlsx（项目根目录）
输出：data/subway.js（项目根目录）

可重复运行：脚本每次都从 Excel 完整重新生成整个文件并覆盖输出，不做增量修改。
Excel 不变时，重复运行的结果逐字节相同。

只用标准库（zipfile + xml.etree），不依赖 openpyxl，也不联网。
脚本只读 Excel、只写输出文件，不碰项目里的其它文件。

────────────────────────────────────────────────────────────────────────
字段映射
────────────────────────────────────────────────────────────────────────
Excel「lines」Sheet          ->  subwayLines[] 的线路字段
    line_id                  ->  line_id
    line_name                ->  line_name          （以 stations Sheet 的值为准）
    station_count            ->  station_count      （转 int；缺失时取实际站数）
    status                   ->  status
    source                   ->  source
    source_url               ->  source_url
    data_checked_at          ->  data_checked_at
    notes                    ->  不导入（整列内容相同，改为写进文件头注释）

Excel「stations」Sheet       ->  subwayLines[].stations[] 的站点字段
    line_id                  ->  用于按线路分组，同时决定线路顺序
    line_name                ->  提升到线路层的 line_name
    station_id               ->  station_id
    physical_station_id      ->  physical_station_id
    station_name             ->  station_name
    station_order            ->  station_order          （转 int）
    latitude                 ->  latitude               （转 float；空 -> null）
    longitude                ->  longitude              （转 float；空 -> null）
    is_transfer_station      ->  is_transfer_station    （"是" -> true，其余 -> false）
    source / source_url /
    data_checked_at          ->  不导入（与 lines Sheet 重复，保留在线路层）
    notes                    ->  不导入（多为缺坐标说明，已归纳进文件头注释）

Excel「README」Sheet         ->  生成文件头部的来源/口径/许可注释
Excel「validation」Sheet     ->  不导入（本脚本自己重新统计并打印）

关于坐标：Excel 里为空的 latitude/longitude 一律写成 null，站点仍然保留。
不补造、不猜测、不用其它坐标系的值填充。
"""

import argparse
import io
import json
import os
import re
import sys
import zipfile
from collections import OrderedDict
from xml.etree import ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_XLSX = os.path.join(ROOT, "beijing_subway.xlsx")
DEFAULT_OUT = os.path.join(ROOT, "data", "subway.js")

# Sheet 在 xlsx 包里的固定位置（本文件由 openpyxl 生成，顺序为 stations/lines/validation/README）
SHEET_STATIONS = "xl/worksheets/sheet1.xml"
SHEET_LINES = "xl/worksheets/sheet2.xml"
SHEET_README = "xl/worksheets/sheet4.xml"

STATION_COLUMNS = 13
LINE_COLUMNS = 8


def column_number(cell_ref):
    """"C12" -> 3。"""
    letters = re.match(r"([A-Z]+)", cell_ref).group(1)
    number = 0
    for char in letters:
        number = number * 26 + (ord(char) - 64)
    return number


def read_sheet(archive, path):
    """读出一个 Sheet 的所有行，每行是 {列号: 单元格文本}。"""
    root = ET.fromstring(archive.read(path))
    rows = []
    for row in root.iter(NS + "row"):
        cells = {}
        for cell in row.findall(NS + "c"):
            value_node = cell.find(NS + "v")
            if cell.get("t") == "inlineStr":
                inline = cell.find(NS + "is")
                text = "".join(t.text or "" for t in inline.iter(NS + "t")) if inline is not None else ""
            else:
                text = value_node.text if value_node is not None else ""
            cells[column_number(cell.get("r"))] = (text or "").strip()
        rows.append(cells)
    return rows


def read_table(archive, path, column_count):
    """把第一行当表头，返回 [{字段名: 值}]。"""
    rows = read_sheet(archive, path)
    header = [rows[0].get(i, "") for i in range(1, column_count + 1)]
    return [{header[i - 1]: row.get(i, "") for i in range(1, column_count + 1)} for row in rows[1:]]


def to_float(text):
    """空字符串 -> None，交给 js() 输出成 null。"""
    if text is None or text == "":
        return None
    return float(text)


def js(value):
    """把 Python 值输出成 JS 字面量。"""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    return json.dumps(value, ensure_ascii=False)


def build_source(xlsx_path):
    """读 Excel，返回 data/subway.js 的完整文本。"""
    archive = zipfile.ZipFile(xlsx_path)
    stations = read_table(archive, SHEET_STATIONS, STATION_COLUMNS)
    lines = read_table(archive, SHEET_LINES, LINE_COLUMNS)
    readme = {row.get(1, ""): row.get(2, "") for row in read_sheet(archive, SHEET_README)}
    line_meta = {row["line_id"]: row for row in lines}

    grouped = OrderedDict()
    for record in stations:
        grouped.setdefault(record["line_id"], []).append(record)

    total = len(stations)
    with_coordinates = len([r for r in stations if r["latitude"] and r["longitude"]])
    physical = len(set(r["physical_station_id"] for r in stations))

    buffer = io.StringIO()
    write = buffer.write

    write("/**\n")
    write(" * 北京地铁线路与站点数据。\n")
    write(" *\n")
    write(" * 由 beijing_subway.xlsx 的 stations / lines / README Sheet 完整转换而来，未做删减。\n")
    write(" * 生成方式：脚本读取 Excel 原样导出，不补造任何字段。\n")
    write(" *\n")
    write(" * 数据来源：%s\n" % readme.get("数据来源", ""))
    write(" * 获取及核验日期：%s\n" % readme.get("获取及核验日期", ""))
    write(" * 统计口径：%s\n" % readme.get("数据统计口径", ""))
    write(" * 换乘站处理：%s\n" % readme.get("换乘站处理", ""))
    write(" * 许可/使用说明：%s\n" % readme.get("许可/使用说明", ""))
    write(" *\n")
    write(" * 规模：%d 条线路 / %d 条线路-站点记录 / %d 个物理站点。\n" % (len(grouped), total, physical))
    write(" * 坐标：%d 条记录有 latitude/longitude，%d 条为 null。\n" % (with_coordinates, total - with_coordinates))
    write(" * 坐标缺失说明：%s\n" % readme.get("坐标说明", ""))
    write(" * 缺坐标的站点一律保留，latitude/longitude 写作 null，不得以缺坐标为由丢弃站点。\n")
    write(" *\n")
    write(" * 已知的原始数据特征（保持与 Excel 一致，未擅自修改）：\n")
    write(" * - 环线首尾闭合：2号线 西直门 出现在 order 1 与 19；10号线 巴沟 出现在 order 1 与 46。\n")
    write(" * - 同一物理站在不同线路各有一条记录，通过 physical_station_id 绑定。\n")
    write(" */\n")
    write("export const subwayLines = [\n")

    for line_id, records in grouped.items():
        meta = line_meta.get(line_id, {})
        declared = int(meta["station_count"]) if meta.get("station_count") else len(records)
        write("  {\n")
        write("    line_id: %s,\n" % js(line_id))
        write("    line_name: %s,\n" % js(records[0]["line_name"]))
        write("    station_count: %s,\n" % js(declared))
        write("    status: %s,\n" % js(meta.get("status", "")))
        write("    source: %s,\n" % js(meta.get("source", "")))
        write("    source_url: %s,\n" % js(meta.get("source_url", "")))
        write("    data_checked_at: %s,\n" % js(meta.get("data_checked_at", "")))
        write("    stations: [\n")
        for record in records:
            write(
                "      { station_id: %s, physical_station_id: %s, station_name: %s, "
                "station_order: %s, latitude: %s, longitude: %s, is_transfer_station: %s },\n"
                % (
                    js(record["station_id"]),
                    js(record["physical_station_id"]),
                    js(record["station_name"]),
                    js(int(record["station_order"])),
                    js(to_float(record["latitude"])),
                    js(to_float(record["longitude"])),
                    js(record["is_transfer_station"] == "是"),
                )
            )
        write("    ],\n")
        write("  },\n")
    write("];\n\n")
    write("/** 扁平化的线路-站点记录，带上所属线路信息；顺序与 Excel 一致。 */\n")
    write("export const subwayStations = subwayLines.flatMap((line) =>\n")
    write("  line.stations.map((station) => ({ line_id: line.line_id, line_name: line.line_name, ...station })),\n")
    write(");\n\n")
    write("/** 有 WGS84 坐标的记录子集；仅供后续“附近有什么”阶段使用，不参与命运模式抽签。 */\n")
    write("export const subwayStationsWithCoordinates = subwayStations.filter(\n")
    write("  (station) => station.latitude !== null && station.longitude !== null,\n")
    write(");\n")

    stats = {
        "lines": len(grouped),
        "station_records": total,
        "physical_stations": physical,
        "with_coordinates": with_coordinates,
        "without_coordinates": total - with_coordinates,
    }
    return buffer.getvalue(), stats


def main(argv=None):
    parser = argparse.ArgumentParser(description="把 beijing_subway.xlsx 转换成 data/subway.js")
    parser.add_argument("--xlsx", default=DEFAULT_XLSX, help="输入的 Excel，默认 beijing_subway.xlsx")
    parser.add_argument("--out", default=DEFAULT_OUT, help="输出的 JS，默认 data/subway.js")
    parser.add_argument("--check", action="store_true", help="只比对不写入；内容有差异时退出码为 1")
    args = parser.parse_args(argv)

    if not os.path.exists(args.xlsx):
        parser.error("找不到输入文件：%s" % args.xlsx)

    source, stats = build_source(args.xlsx)

    print("输入：%s" % args.xlsx)
    print("输出：%s" % args.out)
    print(
        "线路 %d 条 / 线路-站点记录 %d 条 / 物理站点 %d 个 / 有坐标 %d 条 / 无坐标 %d 条"
        % (
            stats["lines"],
            stats["station_records"],
            stats["physical_stations"],
            stats["with_coordinates"],
            stats["without_coordinates"],
        )
    )

    existing = None
    if os.path.exists(args.out):
        with io.open(args.out, encoding="utf-8", newline="") as handle:
            existing = handle.read()

    if args.check:
        if existing == source:
            print("检查通过：现有 data/subway.js 与 Excel 一致，无需重新生成。")
            return 0
        print("检查未通过：现有内容与 Excel 生成结果不一致（未写入任何文件）。")
        return 1

    if existing == source:
        print("内容未变化，文件保持原样。")
        return 0

    with io.open(args.out, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(source)
    print("已写入。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
