"""共享的活动过滤与排序模块。

被 tools/fetch_chncpa.py（新来源生成）使用；同一套规则在前端 app.v2.js 中以
applyActivityFilters() 镜像实现，保证「现有来源 + 新来源」走同一套过滤/排序。

过滤：
  第一层 品类黑名单：便民活动 / 招考招聘 / 惠企活动
  第二层 标题关键词黑名单：详见 TITLE_KEYWORD_BLACKLIST
排序信号（三信号简单分档，非加权）：
  主办方层级（含 街道/社区/村/乡 排后） > 区域（中心城区优先） > 场馆（白名单优先）
"""

from __future__ import annotations

import re
import random
import datetime

# ---------- 第一层：品类黑名单 ----------
CATEGORY_BLACKLIST = {"便民活动", "招考招聘", "惠企活动"}

# ---------- 第二层：标题关键词黑名单 ----------
TITLE_KEYWORD_BLACKLIST = {
    "党史", "反诈", "普法", "宣讲", "进社区", "义诊", "招聘", "政策解读",
    "安全生产", "消防", "主题教育", "表彰",
}

# ---------- 排序信号：知名场馆白名单 ----------
VENUE_WHITELIST = {
    "国家大剧院", "中国国家博物馆", "国家博物馆", "故宫博物院", "首都博物馆",
    "中国美术馆", "北京天文馆", "中国科学技术馆", "国家自然博物馆", "中国地质博物馆",
    "中国园林博物馆", "清华大学艺术博物馆", "北京汽车博物馆", "中国人民革命军事博物馆",
    "中国人民抗日战争纪念馆", "国家典籍博物馆", "中国现代文学馆", "中国电影博物馆",
    "中国妇女儿童博物馆", "中国铁道博物馆", "中国铁道博物馆正阳门展馆",
    "北京天文馆-北京古观象台", "北京民俗博物馆", "北京城市图书馆", "北京中华民族博物院",
    "首都图书馆", "梅兰芳大剧院", "中央歌剧院剧场", "国家话剧院剧场", "北京音乐厅",
    "北京天桥艺术中心", "中国国家话剧院", "国家大剧院-歌剧院", "国家大剧院-音乐厅",
    "国家大剧院-戏剧场",
}

CENTRAL_DISTRICTS = {"东城区", "西城区", "朝阳区", "海淀区"}
MID_DISTRICTS = {"丰台区", "石景山区", "通州区", "昌平区", "门头沟区", "北京市", "线上"}
GRASS_RE = re.compile(r"街道|社区|村|乡")

# 时间窗口基准：前端改为以浏览器真实当前日期为锚；此处镜像为「运行当日」。
def today_tuple():
    t = datetime.date.today()
    return (t.year, t.month, t.day)


def category_blocked(category):
    return category in CATEGORY_BLACKLIST


def title_blocked(name):
    return any(k in (name or "") for k in TITLE_KEYWORD_BLACKLIST)


def filter_activities(items):
    """应用两层过滤，返回新列表（不修改入参）。"""
    out = []
    for a in items:
        if category_blocked(a.get("category")):
            continue
        if title_blocked(a.get("name")):
            continue
        out.append(a)
    return out


def _parse_date(s):
    if not s:
        return None
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", s)
    if m:
        Y, M, D = (int(x) for x in m.groups())
        if 1 <= M <= 12 and 1 <= D <= 31:
            return (Y, M, D)
    return None


def district_tier(d):
    if d in CENTRAL_DISTRICTS:
        return 0
    if d in MID_DISTRICTS:
        return 1
    return 2


def venue_tier(v):
    return 0 if (v in VENUE_WHITELIST) else 1


def organizer_tier(a):
    hay = " ".join(str(a.get(k, "")) for k in ("venue", "address", "name"))
    return 1 if GRASS_RE.search(hay) else 0


def status_rank(a, ref=None):
    if ref is None:
        ref = today_tuple()
    sd = _parse_date(a.get("start_date"))
    ed = _parse_date(a.get("end_date"))
    if not sd and not ed:
        return 2
    if sd and sd > ref:
        return 0
    return 1


def signal_tier(a, ref=None):
    if ref is None:
        ref = today_tuple()
    return (status_rank(a, ref), organizer_tier(a), venue_tier(a.get("venue")),
            district_tier(a.get("district")))


def _shuffle(items):
    arr = list(items)
    for i in range(len(arr) - 1, 0, -1):
        j = random.randrange(i + 1)
        arr[i], arr[j] = arr[j], arr[i]
    return arr


def sort_activities(items, ref=None):
    """先按信号分档，档内随机打散（与前端 app.v2.js 一致）。"""
    buckets = {}
    for a in items:
        t = signal_tier(a, ref)
        buckets.setdefault(t, []).append(a)
    out = []
    for t in sorted(buckets.keys()):
        out.extend(_shuffle(buckets[t]))
    return out
