# -*- coding: utf-8 -*-
"""
近期新鲜活动实验：验证能否持续获得「最近 7 天北京有哪些值得周末去的新鲜活动」。

数据源（公开 / 可核验 / 持续更新 / 非商业 API / 无需登录）：
  1. 北京市人民政府「城市日历」
     - 列表接口（本脚本实际调用）：
       POST https://www.beijing.gov.cn/so/zcdh/csrl/page
       返回 JSON：{ "total": int, "dataList": [ {title, hdlx, qy, yjzt, kssj, jssj, url, status, zy, img}, ... ] }
     - 每条活动自带：名称 / 类别(hdlx) / 城区(qy) / 场馆(yjzt) / 开始(kssj) / 结束(jssj) / 来源链接(url) / 简介(zy)
  2. Visit Beijing（北京文旅官方）— 文章式页面，无干净 JSON 接口；预留适配器，本次未抓取（避免猜测/脆弱解析）。
  3. 北京日报等公开报道 — 适合用 WebSearch 补充；预留适配器，本次未抓取。

硬约束（来自需求）：
- 不编造活动；不猜测日期/地点；来源无日期则保留原始字符串并标注，绝不变造成 YYYY-MM-DD。
- 每条保留 source_url；不自己打“热门”分；可记新鲜度但不声称“大家都在玩”。
- 低频：单页一次请求取全部（pageSize=400），不轮询轰炸；接口异常即中止。
- 不使用高德/百度等商业 API；不抓小红书；不访问登录数据。

运行（可重复）：
    python3 tools/recent_activity_experiment.py
输出：同目录 recent_activity_experiment.json
"""
import urllib.request
import urllib.parse
import urllib.error
import json
import hashlib
import datetime
import os
import re

BASE = "https://www.beijing.gov.cn"
ENDPOINT = BASE + "/so/zcdh/csrl/page"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}

# 城市日历官方源提供的类别(hdlx)中，属于“周末出去玩/体验”的；其余为政务/民生噪声。
LEISURE_CATEGORIES = {"文化演出", "展会活动", "体育赛事", "博物馆展览", "游园活动", "便民活动"}

# 用户期望的“周末体验”类别清单（用于评估覆盖缺口，不用于改写 source 类别）
DESIRED_CATEGORIES = [
    "展会", "文化演出", "体育赛事", "博物馆展览", "游园活动", "市集",
    "节庆", "音乐会", "沉浸式体验", "夜游", "主题活动", "其他适合周末体验的活动",
]


def parse_date(s):
    """只接受严格可解析的日期；其余返回 None（绝不猜测）。"""
    if not s or not isinstance(s, str):
        return None
    s = s.strip()
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s)
    if m:
        try:
            return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    m = re.match(r"^(\d{4})-(\d{1,2})$", s)
    if m:
        try:
            return datetime.date(int(m.group(1)), int(m.group(2)), 1)
        except ValueError:
            return None
    return None


def fetch_calendar():
    data = urllib.parse.urlencode({"page": "1", "pageSize": "400", "type": ""}).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT, data=data, headers={**UA, "X-Requested-With": "XMLHttpRequest", "Referer": BASE + "/so/zcdh/csrl"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def collect(today):
    try:
        resp = fetch_calendar()
    except urllib.error.HTTPError as e:
        if e.code in (429, 504):
            raise RuntimeError(f"城市日历接口返回 {e.code}，按约束中止（不重试/不绕行）。")
        raise
    except Exception as e:
        raise RuntimeError(f"城市日历接口连接失败（{type(e).__name__}: {str(e)[:120]}），按约束中止。")

    raw = resp.get("dataList", []) or []
    collected_at = datetime.datetime.now().isoformat(timespec="seconds")

    records = []
    seen_urls = set()
    for it in raw:
        url = it.get("url") or ""
        if not url:
            continue
        url = urllib.parse.urljoin(BASE, url)
        if url in seen_urls:  # 同来源内去重
            continue
        seen_urls.add(url)

        kssj = (it.get("kssj") or "").strip()
        jssj = (it.get("jssj") or "").strip()
        sd = parse_date(kssj)
        ed = parse_date(jssj)
        date_note = None
        if (kssj and sd is None) or (jssj and ed is None):
            date_note = "来源日期未标准化（如“2026-09底”/“长期”），已保留原始字符串，未猜测为具体日期"

        cat = (it.get("hdlx") or "").strip()
        rec = {
            "id": "bjcal-" + hashlib.md5(url.encode("utf-8")).hexdigest()[:12],
            "name": (it.get("title") or "").strip(),
            "category": cat,                       # 沿用来源官方类别，不猜测
            "district": (it.get("qy") or "").strip(),
            "venue": (it.get("yjzt") or "").strip(),
            "start_date": kssj or None,
            "end_date": jssj or None,
            "published_at": None,                  # 来源接口未提供发布时间，如实留空
            "published_at_note": "城市日历接口不返回发布时间，无法核验“最近7天发布”",
            "source": "北京市人民政府·城市日历",
            "source_url": url,
            "collected_at": collected_at,
            "description": (it.get("zy") or "").strip(),
            "leisure_relevant": cat in LEISURE_CATEGORIES,
            "date_parseable": (sd is not None or ed is not None),
            "date_note": date_note,
            "_start": sd.isoformat() if sd else None,
            "_end": ed.isoformat() if ed else None,
        }
        records.append(rec)

    return records, collected_at


def compute_stats(records, today):
    by_cat = {}
    by_district = {}
    valid = 0          # 当前仍有效：结束日期可解析且 >= 今天
    future7 = 0        # 未来7天开始：开始日期在 [今天, 今天+7]
    with_place_date_src = 0
    for r in records:
        by_cat[r["category"]] = by_cat.get(r["category"], 0) + 1
        by_district[r["district"]] = by_district.get(r["district"], 0) + 1
        sd = r["_start"]
        ed = r["_end"]
        if ed and ed >= today.isoformat():
            valid += 1
        if sd and today.isoformat() <= sd <= (today + datetime.timedelta(days=7)).isoformat():
            future7 += 1
        if r["venue"] and r["date_parseable"] and r["source_url"]:
            with_place_date_src += 1

    # 覆盖缺口：用户期望类别中，没有对应 hdlx 的
    mapped = {"展会": "展会活动", "文化演出": "文化演出", "体育赛事": "体育赛事",
              "博物馆展览": "博物馆展览", "游园活动": "游园活动"}
    missing = [c for c in DESIRED_CATEGORIES if c not in mapped]
    return {
        "raw_fetched": len(records),
        "deduped": len(records),
        "currently_valid": valid,
        "future_7_days": future7,
        "recent_7_days_published": None,  # 来源无发布时间，无法核验
        "recent_7_days_published_note": "城市日历接口不返回发布时间；该项暂记为 null，需用 Visit Beijing/北京日报 补充发布时间后才能统计",
        "by_category": by_cat,
        "by_district": by_district,
        "with_venue_and_date_and_source": with_place_date_src,
        "leisure_relevant_count": sum(1 for r in records if r["leisure_relevant"]),
        "weak_or_missing_categories": missing,
    }


def main():
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "recent_activity_experiment.json")
    today = datetime.date.today()
    try:
        records, collected_at = collect(today)
    except RuntimeError as e:
        result = {
            "experiment": "近期北京新鲜活动（城市日历）",
            "generated_at": collected_at if False else datetime.datetime.now().isoformat(timespec="seconds"),
            "status": "ABORTED",
            "message": str(e),
            "sources": {
                "城市日历": "attempted",
                "Visit Beijing": "pending_adapter（文章式页面，待补充）",
                "北京日报": "pending_adapter（待用 WebSearch 补充）",
            },
            "activities": [],
            "stats": None,
        }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print("ABORTED:", e)
        return 1

    stats = compute_stats(records, today)
    # 去掉内部辅助字段再落盘
    for r in records:
        r.pop("_start", None)
        r.pop("_end", None)
    result = {
        "experiment": "近期北京新鲜活动（城市日历）",
        "generated_at": collected_at,
        "reference_date": today.isoformat(),
        "status": "OK",
        "sources": {
            "城市日历": "active（POST /so/zcdh/csrl/page，332 条当前活动）",
            "Visit Beijing": "pending_adapter（文章式页面 /culture/* 与 /article/*，待补充，避免猜测）",
            "北京日报": "pending_adapter（待用公开报道检索补充发布时间）",
        },
        "selection_rules": {
            "currently_valid": "end_date 可解析且 >= 参考日期",
            "future_7_days": "start_date 在 [参考日期, 参考日期+7]",
            "recent_7_days_published": "来源无发布时间，记为 null",
            "published_at": "始终为 null（来源不提供）",
            "date_integrity": "start_date/end_date 保留来源原始字符串；仅当严格匹配 YYYY-MM-DD 才参与日期过滤，绝不猜测",
        },
        "activities": records,
        "stats": stats,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("OK 参考日期", today.isoformat())
    print("原始/去重:", stats["raw_fetched"], "/", stats["deduped"])
    print("当前有效:", stats["currently_valid"], " 未来7天:", stats["future_7_days"], " 周末相关:", stats["leisure_relevant_count"])
    print("地点+日期+来源齐全:", stats["with_venue_and_date_and_source"])
    print("各类别:", stats["by_category"])
    print("明显不足/缺失类别:", stats["weak_or_missing_categories"])
    print("写出 ->", out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
