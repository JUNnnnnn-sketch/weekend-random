# -*- coding: utf-8 -*-
"""为北京地铁物理站补充 WGS84 坐标，输出 data/station_coordinates.js。

用法（项目根目录）：
    python tools/fetch_station_coordinates.py              # 联网查 Overpass 后生成
    python tools/fetch_station_coordinates.py --from <f>   # 用本地 Overpass 响应生成，不联网
    python tools/fetch_station_coordinates.py --save-raw <f>  # 顺便保存原始响应

输入：
  - data/subway.js 里的物理站（physical_station_id -> station_name），共 396 个
  - Overpass API：北京 bbox 内的地铁站节点

输出：data/station_coordinates.js
  一个以 physical_station_id 为键的坐标覆盖层。**不写进 subway.js**，原因有两个：
    1. subway.js 由 import_subway.py 从 Excel 生成，写进去会在下次重新生成时丢失；
    2. OSM 数据是 ODbL 1.0，与 Excel 来源的许可不同，分开存放才能各自标注清楚。

匹配规则：
  按站名精确匹配，「站」后缀双向归一化（「北京南站」既尝试原名也尝试「北京南」，
  反之亦然）。同名多节点（换乘站的不同站厅）取算术平均——实测 34 个多节点站的
  最大偏离 233 m，无一超过 500 m。

不做的事：
  - 不为匹配不上的站推断坐标。查不到就不写，缺就是缺。
  - 不做模糊匹配。名字对不上宁可漏，不要配错。

许可：坐标来自 OpenStreetMap contributors，ODbL 1.0。
     使用时须保留署名并履行 ODbL 义务。
"""

import argparse
import json
import math
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBWAY_JS = os.path.join(ROOT, "data", "subway.js")
OUT = os.path.join(ROOT, "data", "station_coordinates.js")

UA = "weekend-random/0.1 (personal hobby project; subway station coordinates)"
OVERPASS = "https://overpass-api.de/api/interpreter"
BBOX = "39.40,115.40,41.10,117.60"  # south,west,north,east
QUERY = """
[out:json][timeout:120];
(
  node["railway"="station"]["subway"="yes"](%(bbox)s);
  node["public_transport"="station"]["subway"="yes"](%(bbox)s);
);
out tags center;
""" % {"bbox": BBOX}

# 多节点取平均后，若最大偏离超过这个值，视为同名不同站，不写入
MAX_SPREAD_M = 500


def haversine_m(lat1, lon1, lat2, lon2):
    r = math.radians
    d_lat, d_lon = r(lat2 - lat1), r(lon2 - lon1)
    h = math.sin(d_lat / 2) ** 2 + math.cos(r(lat1)) * math.cos(r(lat2)) * math.sin(d_lon / 2) ** 2
    return 6371000 * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def name_keys(name):
    """站名的候选键：原样，以及「站」后缀的另一种写法。"""
    name = name.strip()
    keys = {name}
    keys.add(name[:-1] if name.endswith("站") else name + "站")
    return keys


def read_physical_stations():
    """从 subway.js 读出 physical_station_id -> station_name。"""
    src = open(SUBWAY_JS, encoding="utf-8").read()
    pattern = r'station_id: ".*?", physical_station_id: "(.*?)", station_name: "(.*?)"'
    stations = {}
    for pid, name in re.findall(pattern, src):
        stations.setdefault(pid, name)
    if not stations:
        raise SystemExit("没能从 data/subway.js 解析出任何站点，先检查它的格式")
    return stations


def fetch_overpass():
    """单次请求，失败不重试——Overpass 是公共服务，504 时应当退让而不是重试。"""
    request = urllib.request.Request(
        OVERPASS,
        data=urllib.parse.urlencode({"data": QUERY}).encode(),
        headers={"User-Agent": UA},
    )
    started = time.time()
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            raw = response.read()
        print("Overpass: HTTP %s  %.2fs  %d KB" % (response.status, time.time() - started, len(raw) // 1024))
        return raw
    except urllib.error.HTTPError as e:
        raise SystemExit("Overpass 返回 HTTP %s %s；不重试，稍后再跑。" % (e.code, e.reason))
    except Exception as e:
        raise SystemExit("Overpass 请求失败：%s: %s" % (type(e).__name__, e))


def index_osm(raw):
    """把 Overpass 响应整理成 站名键 -> [(lat, lon), ...]。"""
    elements = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)["elements"]
    index = defaultdict(list)
    named = 0
    for element in elements:
        tags = element.get("tags") or {}
        name = tags.get("name")
        lat, lon = element.get("lat"), element.get("lon")
        if lat is None and element.get("center"):
            lat, lon = element["center"]["lat"], element["center"]["lon"]
        if not name or lat is None:
            continue
        named += 1
        for key in name_keys(name):
            index[key].append((lat, lon))
    print("OSM 带名字的地铁站要素：%d，去重站名：%d" % (named, len(index)))
    return index


def resolve(stations, index):
    resolved, missing, scattered = {}, [], []
    for pid, name in stations.items():
        points = None
        for key in name_keys(name):
            if key in index:
                points = index[key]
                break
        if not points:
            missing.append(name)
            continue
        unique = sorted({(round(a, 6), round(b, 6)) for a, b in points})
        lat = sum(p[0] for p in unique) / len(unique)
        lon = sum(p[1] for p in unique) / len(unique)
        spread = max(haversine_m(lat, lon, p[0], p[1]) for p in unique)
        if spread > MAX_SPREAD_M:
            scattered.append((name, round(spread)))
            continue
        resolved[pid] = {
            "station_name": name,
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "osm_nodes": len(unique),
            "spread_m": round(spread, 1),
        }
    return resolved, missing, scattered


def write_js(resolved, total, missing, scattered):
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    lines = []
    w = lines.append
    w("/**")
    w(" * 北京地铁物理站的 WGS84 坐标覆盖层，键为 physical_station_id。")
    w(" *")
    w(" * 数据来源：OpenStreetMap contributors，经 Overpass API 查询获得。")
    w(" * 许可：ODbL 1.0 —— 使用本数据须保留 © OpenStreetMap contributors 署名")
    w(" *       并履行 ODbL 义务。")
    w(" * 获取时间：%s" % now)
    w(" *")
    w(" * 覆盖：%d / %d 个物理站（%.1f%%）。" % (len(resolved), total, 100.0 * len(resolved) / total))
    w(" * 未匹配 %d 个，集中在新开通线路与远郊（亦庄T1线 / S1线 / 西郊线等）；" % len(missing))
    w(" * 匹配不上的站不写入，也不推断坐标——缺就是缺。")
    w(" *")
    w(" * 换乘站在 OSM 中常有多个节点（不同站厅），此处取算术平均；")
    w(" * 偏离超过 %d m 的视为同名不同站，同样不写入。" % MAX_SPREAD_M)
    w(" *")
    w(" * 坐标系：WGS84。中国大陆在线底图多为 GCJ-02，直接叠加会有偏移，")
    w(" * 本文件未做任何纠偏。")
    w(" *")
    w(" * 本文件由 tools/fetch_station_coordinates.py 生成，不要手工编辑。")
    w(" * 坐标刻意不写进 subway.js：那个文件由 Excel 生成，写进去会在重新生成时丢失，")
    w(" * 且两者许可不同，分开存放才能各自标注清楚。")
    w(" */")
    w("export const stationCoordinates = {")
    for pid in sorted(resolved):
        item = resolved[pid]
        w('  "%s": { station_name: %s, latitude: %s, longitude: %s, osm_nodes: %d },'
          % (pid, json.dumps(item["station_name"], ensure_ascii=False),
             item["latitude"], item["longitude"], item["osm_nodes"]))
    w("};")
    w("")
    w("/** 坐标来源署名，展示坐标相关内容时应当带上。 */")
    w('export const stationCoordinateSource = {')
    w('  name: "OpenStreetMap contributors",')
    w('  url: "https://www.openstreetmap.org/copyright",')
    w('  license: "ODbL 1.0",')
    w('  fetched_at: "%s",' % now)
    w("};")
    w("")
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description="为北京地铁物理站补充 WGS84 坐标")
    parser.add_argument("--from", dest="from_file", help="使用本地 Overpass 响应文件，不联网")
    parser.add_argument("--save-raw", help="把 Overpass 原始响应另存到此路径")
    args = parser.parse_args()

    stations = read_physical_stations()
    print("subway.js 物理站：%d" % len(stations))

    if args.from_file:
        raw = open(args.from_file, "rb").read()
        print("使用本地响应：%s" % args.from_file)
    else:
        raw = fetch_overpass()
    if args.save_raw:
        open(args.save_raw, "wb").write(raw)

    index = index_osm(raw)
    resolved, missing, scattered = resolve(stations, index)

    print()
    print("已解析：%d / %d  (%.1f%%)" % (len(resolved), len(stations), 100.0 * len(resolved) / len(stations)))
    print("未匹配：%d" % len(missing))
    if scattered:
        print("同名节点过于分散而舍弃：%d —— %s" % (len(scattered), scattered[:5]))
    multi = [v for v in resolved.values() if v["osm_nodes"] > 1]
    if multi:
        print("多节点取平均：%d 个站，最大偏离 %.0f m"
              % (len(multi), max(v["spread_m"] for v in multi)))

    write_js(resolved, len(stations), missing, scattered)
    print()
    print("已写出：%s" % OUT)


if __name__ == "__main__":
    main()
