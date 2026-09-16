# -*- coding: utf-8 -*-
"""
近期活动「最近在玩」正式数据管道（替换实验脚本 recent_activity_experiment.py）。

输入（公开 / 可核验 / 持续更新 / 非商业 API / 无需登录）：
  - 默认（联网）：北京市人民政府「城市日历」列表接口
      POST https://www.beijing.gov.cn/so/zcdh/csrl/page
      返回 JSON：{ "total", "dataList": [ {title, hdlx, qy, yjzt, kssj, jssj, url, status, zy, img}, ... ] }
  - --from-snapshot <path>：读取本地 recent_activity_experiment.json（不联网），
    用于「不重新抓取」地把已有实验数据落地为正式 activities.js。

输出：../data/activities.js
  - 保留 source_url、collected_at、updated_at
  - 已结束活动（end_date 可解析且 < 基准日）不写入正式文件
  - 不改变其他模块（subway.js / places.js / recommendation.js / 命运模式 / 随便逛逛）

兼容性说明（重要，先检查过 schema.js）：
  data/schema.js 的 activityRequiredFields = placeRequiredFields(...) + start_date/end_date，
  其中 latitude/longitude/address/suitable_for_people/suitable_duration 是“地点”字段。
  活动是“事件”不是带坐标的地点，因此本脚本：
    - latitude/longitude 写 null（与 subway.js 缺坐标约定一致，本阶段不做地铁站关联）
    - address 写 venue（来源只给场馆名，不给街道地址；不编造街道地址）
    - suitable_for_people / suitable_duration 写“无限制默认”，
      仅用于不破坏 recommendation.js 的 recommend()（它会对 activities 调 .includes）；
      这些默认不参与「最近在玩」展示，也不表示活动有真实的人数/时长限制。
  这样 data/activities.js 可直接被现有 schema 与 recommend() 消费，无需修改 schema.js。

硬约束（来自需求）：
  - 不编造、不猜测日期/地点/类型；来源日期未标准化则保留原始字符串并标注 date_note。
  - 每条保留 source_url；不自己打“热门”分。
  - 低频：单页一次请求取全部（pageSize=400），不轮询；接口异常即中止（不重试/不绕行）。
  - 不使用高德/百度等商业 API；不抓小红书；不访问登录数据。

运行：
    python3 tools/update_recent_activities.py                # 联网抓取 -> data/activities.js
    python3 tools/update_recent_activities.py --from-snapshot tools/recent_activity_experiment.json  # 用本地快照
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://www.beijing.gov.cn"
ENDPOINT = BASE + "/so/zcdh/csrl/page"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_JS = os.path.join(ROOT, "data", "activities.js")

# 城市日历官方类别中属于“周末出去玩/体验”的；其余为政务/民生噪声（仅做统计，不在本层过滤，
# 展示层 recent 模式会过滤掉 招考招聘 / 惠企活动）。
LEISURE_CATEGORIES = {"文化演出", "展会活动", "体育赛事", "博物馆展览", "游园活动", "便民活动"}


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
        ENDPOINT, data=data,
        headers={**UA, "X-Requested-With": "XMLHttpRequest", "Referer": BASE + "/so/zcdh/csrl"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def collect_from_api(today):
    """联网：返回 (raw_records, as_of_date, collected_at)。raw_records 形状与实验 JSON 活动一致。"""
    try:
        resp = fetch_calendar()
    except urllib.error.HTTPError as e:
        if e.code in (429, 504):
            raise RuntimeError(f"城市日历接口返回 {e.code}，按约束中止（不重试/不绕行）。")
        raise
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"城市日历接口连接失败（{type(e).__name__}: {str(e)[:120]}），按约束中止。")

    raw = resp.get("dataList", []) or []
    collected_at = datetime.datetime.now().isoformat(timespec="seconds")
    records = []
    seen = set()
    for it in raw:
        url = it.get("url") or ""
        if not url:
            continue
        url = urllib.parse.urljoin(BASE, url)
        if url in seen:
            continue
        seen.add(url)
        kssj = (it.get("kssj") or "").strip()
        jssj = (it.get("jssj") or "").strip()
        sd, ed = parse_date(kssj), parse_date(jssj)
        date_note = None
        if (kssj and sd is None) or (jssj and ed is None):
            date_note = "来源日期未标准化（如“2026-09底”/“长期”），已保留原始字符串，未猜测为具体日期"
        cat = (it.get("hdlx") or "").strip()
        records.append({
            "id": "bjcal-" + hashlib.md5(url.encode("utf-8")).hexdigest()[:12],
            "name": (it.get("title") or "").strip(),
            "category": cat,
            "district": (it.get("qy") or "").strip(),
            "venue": (it.get("yjzt") or "").strip(),
            "start_date": kssj or None,
            "end_date": jssj or None,
            "published_at": None,
            "published_at_note": "城市日历接口不返回发布时间，无法核验“最近7天发布”",
            "source": "北京市人民政府·城市日历",
            "source_url": url,
            "collected_at": collected_at,
            "description": (it.get("zy") or "").strip(),
            "leisure_relevant": cat in LEISURE_CATEGORIES,
            "date_parseable": (sd is not None or ed is not None),
            "date_note": date_note,
        })
    return records, today, collected_at


def collect_from_snapshot(path):
    """本地快照：读取 recent_activity_experiment.json 的 activities。"""
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    if doc.get("status") != "OK":
        raise RuntimeError(f"快照状态异常（{doc.get('status')}），未生成 activities.js。")
    as_of = datetime.date.fromisoformat(doc["reference_date"]) if doc.get("reference_date") else datetime.date.today()
    return doc.get("activities", []), as_of, doc.get("generated_at")


def to_output_record(raw, collected_at):
    """把一条 raw 活动映射为写入 activities.js 的最终记录（满足现有 schema.activityRequiredFields）。"""
    return {
        "id": raw["id"],
        "name": raw["name"],
        "category": raw["category"],
        # 活动不是带坐标地点：坐标留 null（与 subway.js 缺坐标约定一致）；本阶段不做地铁站关联。
        "latitude": None,
        "longitude": None,
        # 来源只给场馆名，不给街道地址；用 venue 作为已知位置描述，不编造街道地址。
        "address": raw.get("venue") or "",
        # 无限制默认：仅用于不破坏 recommendation.js 的 recommend()（它对 activities 调 .includes）；
        # 不参与「最近在玩」展示，也不表示活动有真实的人数/时长限制。
        "suitable_for_people": ["一个人", "两个人", "一群人"],
        "suitable_duration": ["2-3小时", "半天", "一整天"],
        "district": raw.get("district") or "",
        "venue": raw.get("venue") or "",
        "start_date": raw.get("start_date"),
        "end_date": raw.get("end_date"),
        "published_at": raw.get("published_at"),
        "source": raw.get("source") or "北京市人民政府·城市日历",
        "source_url": raw.get("source_url"),
        "collected_at": raw.get("collected_at") or collected_at,
        "updated_at": raw.get("collected_at") or collected_at,
        "description": raw.get("description") or "",
    }


def generate(records, as_of, collected_at):
    """过滤已结束（end_date 可解析且 < as_of），映射为最终记录。"""
    out = []
    dropped_ended = 0
    for raw in records:
        ed = parse_date(raw.get("end_date"))
        if ed is not None and ed < as_of:
            dropped_ended += 1
            continue
        out.append(to_output_record(raw, collected_at))
    return out, dropped_ended


def render_js(records, as_of, collected_at):
    items = ",\n  ".join(json.dumps(r, ensure_ascii=False) for r in records)
    return (
        "// 由 tools/update_recent_activities.py 生成 —— 数据源：北京市人民政府「城市日历」公开接口\n"
        "// 重新生成：python3 tools/update_recent_activities.py  （联网）\n"
        "//           python3 tools/update_recent_activities.py --from-snapshot tools/recent_activity_experiment.json （不联网）\n"
        f"// 抓取时间 collected_at：{collected_at}\n"
        "// 基准日 activityDataAsOf：「当前有效 / 即将开始」判断以此为锚（联网模式为运行当日）。\n"
        "// 说明：latitude/longitude 为 null（城市日历不提供坐标，本阶段不做地铁站关联）；\n"
        "//      suitable_for_people/suitable_duration 为“无限制默认”，仅用于不破坏其他模块，不参与最近在玩展示。\n"
        f'export const activityDataAsOf = "{as_of.isoformat()}";\n\n'
        "export const activities = [\n  "
        + (items if items else "")
        + "\n];\n\n"
        "export const activitySources = [\n"
        '  { name: "北京市人民政府·城市日历", url: "https://www.beijing.gov.cn/so/zcdh/csrl", status: "已接入（公开接口·免费·无需登录）" },\n'
        "];\n"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-snapshot", help="读取本地实验快照 JSON（不联网）而非调用城市日历接口")
    args = ap.parse_args()

    try:
        if args.from_snapshot:
            records, as_of, collected_at = collect_from_snapshot(args.from_snapshot)
            src_label = f"快照 {args.from_snapshot}"
        else:
            records, as_of, collected_at = collect_from_api(datetime.date.today())
            src_label = "城市日历接口（联网）"
    except RuntimeError as e:
        print("ABORTED:", e)
        return 1

    out, dropped_ended = generate(records, as_of, collected_at)
    js = render_js(out, as_of, collected_at)
    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write(js)

    print(f"来源：{src_label}")
    print(f"基准日：{as_of.isoformat()}  抓取时间：{collected_at}")
    print(f"原始活动：{len(records)}  已结束(过滤)：{dropped_ended}  写入 activities.js：{len(out)}")
    print(f"写出 -> {OUT_JS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
