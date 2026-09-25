#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取国家大剧院官网首页「演出推荐」区，生成 data/activities_chncpa.js。

公共机构公开数据，仅用于「最近在玩」文化演出补充。
- 首页为服务端渲染（非 SPA），演出名/日期区间/详情链接直接在 HTML 中。
- 场馆字段首页卡片不含（详情页是购票系统 JS 重定向，无法取），统一填
  「国家大剧院 / 西城区」（品牌主体，且在白名单 + 中心城区，排序无害）。
- 过滤与排序走共享模块 tools/activity_filter.py，与前端规则一致。

运行：python3 tools/fetch_chncpa.py
依赖：仅标准库。
"""
import os
import re
import sys
import json
import datetime
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from activity_filter import filter_activities, sort_activities

BASE = "https://www.chncpa.org/"
HOME = BASE  # 首页即含「演出推荐」区
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

OUT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "data", "activities_chncpa.js")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "ignore")


def _text(el):
    return re.sub(r"<[^>]+>", "", el or "").strip()


def parse(html):
    items = []
    # 只在「演出推荐」区块（class="yctj"）内抽取，避免抓到新闻/导航
    m = re.search(r'class="yctj[^"]*"', html)
    seg = html[m.start(): m.start() + 40000] if m else html

    for li in re.findall(r"<li[^>]*>.*?</li>", seg, re.S):
        href = re.search(r'href="(\./ycxm/[^"]+\.html)"', li)
        if not href:
            continue
        # 名称：优先 class="h5" / class="shengls"
        name = (re.search(r'<a[^>]*class="h5"[^>]*>(.*?)</a>', li, re.S)
                or re.search(r'<h6[^>]*class="shengls"[^>]*>(.*?)</h6>', li, re.S)
                or re.search(r'<h5[^>]*class="shengls"[^>]*>(.*?)</h5>', li, re.S))
        if not name:
            continue
        nm = _text(name.group(1))
        if not nm:
            continue

        # 日期：取首个含 20xx 的 <p>
        date_txt = ""
        for p in re.findall(r"<p[^>]*>(.*?)</p>", li, re.S):
            if re.search(r"\d{4}/\d{1,2}/\d{1,2}", p):
                date_txt = _text(p)
                break
        date_txt = re.sub(r"<!--.*?-->", "", date_txt)
        sd = ed = None
        mm = re.search(r"(\d{4})/(\d{1,2})/(\d{1,2})\s*-\s*(\d{4})/(\d{1,2})/(\d{1,2})", date_txt)
        if mm:
            sd = "%s-%02d-%02d" % (mm.group(1), int(mm.group(2)), int(mm.group(3)))
            ed = "%s-%02d-%02d" % (mm.group(4), int(mm.group(5)), int(mm.group(6)))
        else:
            mm2 = re.search(r"(\d{4})/(\d{1,2})/(\d{1,2})", date_txt)
            if mm2:
                d = "%s-%02d-%02d" % (mm2.group(1), int(mm2.group(2)), int(mm2.group(3)))
                sd = ed = d
        if not sd:
            continue

        url = BASE + href.group(1)[2:]  # 去掉开头的 ./
        mid = re.search(r"t(\d+)_(\d+)", href.group(1))
        aid = "chncpa-" + (mid.group(0) if mid else re.sub(r"\D", "", href.group(1))[:12])
        items.append({
            "id": aid,
            "name": nm,
            "category": "文化演出",
            "latitude": None,
            "longitude": None,
            "address": "国家大剧院",
            "suitable_people": [],
            "suitable_duration": [],
            "district": "西城区",
            "venue": "国家大剧院",
            "start_date": sd,
            "end_date": ed,
            "published_at": None,
            "source": "国家大剧院官方网站",
            "source_url": url,
            "collected_at": None,
            "updated_at": None,
            "description": None,
        })

    # 去重（同一演出可能同时出现在 .big 与 ol.solo）
    seen, uniq = set(), []
    for it in items:
        if it["id"] in seen:
            continue
        seen.add(it["id"])
        uniq.append(it)
    return uniq


def main():
    html = fetch(HOME)
    raw = parse(html)
    print(f"抓取原始条数：{len(raw)}")
    filtered = filter_activities(raw)
    print(f"过滤后条数：{len(filtered)}（被过滤 {len(raw) - len(filtered)} 条）")
    sorted_items = sort_activities(filtered)
    fetched_at = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    lines = [
        "// 自动生成，请勿手动编辑。来源：国家大剧院官方网站「演出推荐」",
        f"// fetchedAt: {fetched_at} | 原始 {len(raw)} 条 | 过滤后 {len(filtered)} 条",
        'export const fetchedAt = "%s";' % fetched_at,
        "export const activitiesChncpa = [",
    ]
    for it in sorted_items:
        lines.append("  " + json.dumps(it, ensure_ascii=False) + ",")
    lines.append("];")
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"已写出：{OUT_PATH}")
    print("样例：")
    for it in sorted_items[:3]:
        print(f"  - {it['name']} | {it['start_date']}~{it['end_date']} | {it['source_url']}")


if __name__ == "__main__":
    main()
