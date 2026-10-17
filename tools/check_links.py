#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把数据里所有官网链接访问一遍，列出打不开的。

为什么要查：官网这一栏有三个来源——OSM 的 website 标签、Wikidata 的 P856、
人工填的。前两个是别人几年前填的，站点改版、换域名、停办都不会有人回来改。
实测颐和园和龙泉寺在 OSM 里的网址都已经 503 了。界面上点名字进官网，
点出来一个打不开的页面，比老老实实什么都不挂更糟。

礼貌：串行，请求之间停 GAP 秒，超时就算失败不重试。
不做的事：不自动删链接。打不开可能是临时的，也可能是这边网络的问题，
         判断交给人。

用法：
    python tools/check_links.py            # 查全部
    python tools/check_links.py --only-bad # 只打印有问题的
"""
import argparse
import io
import re
import sys
import time
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) weekend-random/1.0 (personal hobby project)"
GAP = 0.3
TIMEOUT = 15


def links():
    """名字 -> 网址，两张生成出来的数据里全部的 website。"""
    out = {}
    for name in ("station_pois.js", "curated_places.js"):
        src = io.open("%s/data/%s" % (ROOT, name), encoding="utf-8").read()
        for chunk in re.findall(r"\{[^{}]*website[^{}]*\}", src):
            n = re.search(r'"?name"?: "(.*?)"', chunk)
            w = re.search(r'"?website"?: "(.*?)"', chunk)
            if n and w:
                out.setdefault(n.group(1), w.group(1))
    return out


# 域名过期被抢注是最危险的一种坏链：它返回 200，看着"活着"，点进去是
# 盗版影视站或赌博站。百工博物馆的 jcbgf.com 就是这样——我这边看是 404，
# 用户在国内看到的是「66电影网」。所以光看状态码不够，还得看页面讲的是什么。
SPAM = ("电影", "影视", "在线观看", "彩票", "赌", "棋牌", "贷款", "域名出售",
        "本站出售", "购买此域名", "This domain", "for sale")


def page_title(url):
    """取回页面标题，用来判断内容对不对得上。失败返回空串。"""
    result = subprocess.run(
        ["curl", "-sS", "-L", "--max-time", str(TIMEOUT), "-A", UA, url],
        capture_output=True, text=True, errors="replace")
    match = re.search(r"<title[^>]*>(.*?)</title>", result.stdout or "", re.S | re.I)
    return re.sub(r"\s+", " ", match.group(1)).strip()[:80] if match else ""


def probe(url):
    """用 curl 发请求，不用 urllib。

    第一版用的 urllib，报出来 38 条打不开，复核发现至少 4 条是误报——
    朝阳公园、北大赛克勒、湖广会馆、798 官网在 curl 下都是 200。
    问题出在 TLS 握手：这些站的证书链或协议组合 Python 这边谈不拢，
    curl 可以。工具自己出错比没有工具更糟，所以换成 curl。
    """
    result = subprocess.run(
        ["curl", "-sS", "-o", os.devnull, "-w", "%{http_code}", "-L",
         "--max-time", str(TIMEOUT), "-A", UA, url],
        capture_output=True, text=True)
    code = (result.stdout or "").strip()
    try:
        return int(code), (result.stderr or "").strip()[:60]
    except ValueError:
        return 0, (result.stderr or code).strip()[:60]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only-bad", action="store_true")
    args = parser.parse_args()
    items = sorted(links().items())
    print("共 %d 条链接\n" % len(items))
    bad = []
    for index, (name, url) in enumerate(items, 1):
        status, why = probe(url)
        ok = 200 <= status < 400
        if ok:
            title = page_title(url)
            hit = [w for w in SPAM if w in title]
            if hit:
                ok = False
                why = "标题可疑：%s ← %s" % (title, "/".join(hit))
        if not ok:
            bad.append((name, url, status, why))
        if not args.only_bad:
            print("  %-3d %-22s %s %s" % (index, name[:22], status or "✗", url[:58]))
        time.sleep(GAP)
    print("\n打不开的 %d 条：" % len(bad))
    for name, url, status, why in bad:
        print("  %-22s %-4s %-52s %s" % (name[:22], status or "✗", url[:52], why))
    print("\n链接一条没删——打不开可能是临时的，判断交给人。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
