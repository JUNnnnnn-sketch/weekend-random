# -*- coding: utf-8 -*-
"""抓取地铁站周边「值得专门去」的 POI，输出 data/station_pois.js。

用法（项目根目录）：
    python tools/fetch_station_pois.py            # 缺哪组抓哪组，然后生成文件
    python tools/fetch_station_pois.py --rebuild  # 只用已缓存的响应重新生成，不联网
    python tools/fetch_station_pois.py --force    # 忽略缓存，全部重抓

输入：Overpass API（OpenStreetMap），北京 bbox
输出：data/station_pois.js —— 扁平的 POI 列表（不预先按站分组）

为什么是扁平列表而不是「每站一个清单」：
  同一个博物馆会落在好几个站的范围内，按站分组会大量重复；而且半径一改就得
  重新生成。扁平列表由前端在运行时按距离匹配，改半径不用重跑脚本。

分批抓取：
  Overpass 是公共服务，一次把所有品类拉回来响应太大（实测 667KB 处传输中断），
  且容易触发 429。因此按品类分组、逐组请求、组间停顿；每组的原始响应缓存到
  tools/.cache/ 下，被 429 中断后下次运行只补缺的组，不会重复拉已经拿到的。

  遇到 429 立即停止后续请求——这是服务端明确的退让信号，不是可以重试的错误。
  传输中断（IncompleteRead 之类）则重试一次，那是链路问题不是服务端拒绝。

刻意不收的品类：
  - amenity=restaurant：北京有上万条，且绝大多数不是「值得专门坐地铁去」的地方。
  - amenity=cafe：838 条里 426 条是连锁（星巴克/瑞幸/喜茶），
    剩下的也无从判断好坏——OSM 里只有 111 条带营业时间或网站。
  - tourism=attraction：820 条里大量是「簋街雕像」「帽儿胡同」这类地图要素。
  收进来只会稀释真正值得推荐的那几百条。等有了人气信号再说。

许可：POI 数据来自 OpenStreetMap contributors，ODbL 1.0。
     使用须保留署名并履行 ODbL 义务。
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
from collections import Counter
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache")
OUT = os.path.join(ROOT, "data", "station_pois.js")

UA = "weekend-random/0.1 (personal hobby project; POI near subway stations)"
OVERPASS = "https://overpass-api.de/api/interpreter"
# 由 data/station_coordinates.js 的坐标范围加约 2km 余量得出
BBOX = "39.49,115.95,40.26,116.76"
GAP_SECONDS = 3

# 分组抓取：每组单独请求、单独缓存
GROUPS = {
    "culture":     [("tourism", "museum"), ("tourism", "gallery"), ("amenity", "arts_centre")],
    "performance": [("amenity", "theatre"), ("amenity", "cinema"), ("amenity", "nightclub")],
    "nightlife":   [("amenity", "bar"), ("amenity", "pub")],
    "nature":      [("leisure", "park"), ("leisure", "garden"), ("tourism", "zoo"),
                    ("leisure", "nature_reserve")],
    "heritage":    [("amenity", "place_of_worship"), ("historic", "temple"),
                    ("historic", "ruins"), ("historic", "monument")],
    "food":        [("amenity", "restaurant")],
    "reading":     [("shop", "books"), ("amenity", "library")],
    "venue":       [("leisure", "stadium"), ("tourism", "aquarium")],
    "mall":        [("shop", "mall")],
    # 「玩乐场地」：这些玩法场地稀缺，去哪一家是有区别的，必须给具体地点。
    # 实测 OSM 覆盖很不均匀——攀岩 28 家可用，而滑冰只有 2 条（其中一条还是
    # 轮滑场）、射箭和保龄球各 1 家，这三项只能不给地点。
    "playvenue":   [("sport", "climbing"), ("sport", "karting"), ("sport", "billiards"),
                    ("sport", "equestrian"), ("leisure", "horse_riding"),
                    ("amenity", "karaoke_box")],
    # 三里屯太古里、蓝色港湾、THE BOX、华贸这类在 OSM 里不是 shop=mall 而是
    # landuse=retail（整块商业用地）。这一类整体抓会非常噪，故按品牌名直接点取。
    "retail":      [("landuse", "retail")],
    # attraction 放最后：它和公园/古迹/博物馆大量重叠，让那些先匹配，
    # 这一组只兜住前面没覆盖到的——比如潘家园旧货市场。
    "attraction":  [("tourism", "attraction")],
}

# 某些分组必须在 Overpass 端就收窄，否则响应过大。
# 北京的 amenity=restaurant 上万条，绝大多数是普通馆子；这里只取至少带一项
# 强信号的（有人认真标过官网 / 维基 / 营业时间），实测 269 条，连锁仅 9 家。
# 注意：这不是「人气」——OSM 没有人气数据，它只说明有人在意过这家店。
# 需要按名字正则匹配的分组，直接给出完整查询。
RAW_QUERY = {
    "retail": (
        "[out:json][timeout:120];\n"
        "(\n"
        '  nwr["landuse"="retail"]["name"~"%(brands)s"](%(bbox)s);\n'
        '  nwr["landuse"="commercial"]["name"~"%(brands)s"](%(bbox)s);\n'
        ");\n"
        "out center tags;\n"
    ),
}
RETAIL_BRANDS = ("太古里|蓝色港湾|SOLANA|THE BOX|大悦城|SKP|颐堤港|三里屯|华贸|国贸商城|"
                 "恒隆|侨福|王府中环|世贸天阶|合生汇|荟聚|万象城|来福士|新光天地|芳草地")

REQUIRE_ANY = {
    "food": ["website", "wikidata", "opening_hours"],
    # attraction 原始 820 条、噪声极大（「簋街雕像」「帽儿胡同」），
    # 直接在 Overpass 端要求带强信号，既降响应体积也省掉大部分噪声。
    "attraction": ["wikidata", "wikipedia", "website", "fee", "opening_hours"],
}

# 「气质」这件事 OSM 没有字段，但「有没有官网」是个可用的代用指标：
# 肯花力气弄个官网的馆子，基本不会是食堂或平价快餐。
# 实测 269 家按信号分三档——有官网/维基的 31 家是大董、胡大、鸿宾楼、铃木食堂、
# TRB Hutong、老舍茶馆、便宜坊这类；只有营业时间的 119 家是永和豆浆、护国寺小吃、
# 新乐群食堂、学子居这类。后两档不是「值得专门去」，一律不收。
STRICT_SIGNAL = {("amenity", "restaurant")}
# 咖啡馆试过同样的「有官网」判据，不成立：全北京只有 32 家咖啡馆填了官网，
# 其中绝大多数是星巴克——连锁才有人维护这些字段，独立咖啡馆没有。
# 排掉连锁后只剩 3 家，收了没有意义，故不收咖啡。


def has_site_signal(tags):
    return bool(tags.get("wikidata") or tags.get("wikipedia")
                or tags.get("website") or tags.get("contact:website"))


# 公园要比「标签够多」更硬的证据。原先沿用通用质量筛（含「标签数 >= 6」这条
# 兜底），结果放进来一批校园绿地与街心花坛——用户抽到「中心花园」，一搜是
# 北京理工大学里的一块地。街心花坛也能有六七个标签，标签数证明不了它值得去。
# 改成必须有维基条目、官网或门票信息：168 条收到 67 条，而天坛、景山、北海、
# 颐和园、圆明园、玉渊潭、奥森、紫竹院、陶然亭、香山、八大处等 19 个点名
# 核对的地方一个没漏。
PARK_TAGS = {("leisure", "park"), ("leisure", "garden"),
             ("tourism", "zoo"), ("leisure", "nature_reserve")}


def has_landmark_signal(tags):
    return bool(tags.get("wikidata") or tags.get("wikipedia") or tags.get("website")
                or tags.get("contact:website") or tags.get("fee"))

# 全国连锁不是「值得专门去」的地方——哪儿都有，不必让命运替你挑。
# 只排全国性连锁；北京本地的小连锁（紫光园、南城香一类）保留。
CHAIN_KEYWORDS = ["麦当劳", "肯德基", "KFC", "必胜客", "星巴克", "汉堡王", "真功夫",
                  "永和大王", "吉野家", "萨莉亚", "呷哺", "华莱士", "德克士",
                  "赛百味", "Subway", "海底捞", "西贝", "太二", "九毛九", "外婆家",
                  "绿茶餐厅", "杨国福", "张亮麻辣烫", "和府捞面", "老乡鸡",
                  "大米先生", "南京大牌档", "探鱼", "瑞幸", "COSTA", "Costa",
                  "喜茶", "奈雪", "蜜雪冰城", "茶百道", "古茗", "小肥羊", "小龙坎",
                  "谭鸭血", "蜀大侠", "庆丰包子", "嘉和一品", "味千拉面",
                  "食其家", "避风塘", "李先生", "眉州东坡", "大鸭梨"]
# 注意：老字号（全聚德、东来顺、便宜坊一类）虽然也是连锁，但确实是会专程去的
# 目的地，不在排除之列。这里只排「哪儿都有、不值得为它坐地铁」的那种。

# OSM 标签 -> (展示品类, 子类型, 是否需要质量信号)
#
# strict=True 的品类必须带质量信号才收录。原因：博物馆、剧场、酒吧本身就是
# 目的地型场所，标了就基本可用；而公园和古迹不是——北京有 1197 个 leisure=park，
# 里面大量是「东沙窝村头公园」「X10地块口袋公园」这种小区绿地，古迹里也混着
# 「钱学森雕像」这类地图要素。实测质量筛把公园 1339 收到 169、古迹 1132 收到 134，
# 而天坛/景山/颐和园/圆明园/雍和宫/法源寺这些该留的一个没漏。
CATEGORY = {
    ("tourism", "museum"):           ("🎨 艺术 / 展览", "博物馆", False),
    ("tourism", "gallery"):          ("🎨 艺术 / 展览", "美术馆 / 画廊", False),
    ("amenity", "arts_centre"):      ("🎨 艺术 / 展览", "艺术中心", False),
    ("amenity", "theatre"):          ("🎵 音乐 / 演出", "剧场", False),
    ("amenity", "cinema"):           ("🎵 音乐 / 演出", "影院", False),
    ("amenity", "nightclub"):        ("🎵 音乐 / 演出", "Live House / 夜店", False),
    ("amenity", "bar"):              ("🍸 夜生活", "酒吧", False),
    ("amenity", "pub"):              ("🍸 夜生活", "酒馆", False),
    ("leisure", "park"):             ("🌳 公园 / 自然", "公园", True),
    ("leisure", "garden"):           ("🌳 公园 / 自然", "园林", True),
    ("tourism", "zoo"):              ("🌳 公园 / 自然", "动物园", True),
    ("leisure", "nature_reserve"):   ("🌳 公园 / 自然", "自然保护区", True),
    ("amenity", "place_of_worship"): ("🏛 寺庙 / 古迹", "寺庙 / 教堂", True),
    ("historic", "temple"):          ("🏛 寺庙 / 古迹", "古寺", True),
    ("historic", "ruins"):           ("🏛 寺庙 / 古迹", "遗址", True),
    ("historic", "monument"):        ("🏛 寺庙 / 古迹", "古迹", True),
    ("amenity", "restaurant"):       ("🍜 吃喝", "餐厅", False),
    ("shop", "books"):               ("📚 书店 / 图书馆", "书店", True),
    ("amenity", "library"):          ("📚 书店 / 图书馆", "图书馆", True),
    ("shop", "mall"):                ("🛍 商场 / 商圈", "商场", False),
    ("landuse", "retail"):           ("🛍 商场 / 商圈", "商圈", False),
    ("landuse", "commercial"):       ("🛍 商场 / 商圈", "商圈", False),
    ("sport", "climbing"):           ("🎯 玩乐场地", "攀岩", False),
    ("sport", "karting"):            ("🎯 玩乐场地", "卡丁车", False),
    ("sport", "billiards"):          ("🎯 玩乐场地", "台球", False),
    ("sport", "equestrian"):         ("🎯 玩乐场地", "马术", False),
    ("leisure", "horse_riding"):     ("🎯 玩乐场地", "马术", False),
    ("amenity", "karaoke_box"):      ("🎯 玩乐场地", "KTV", False),
    ("leisure", "stadium"):          ("🏟 场馆 / 运动", "体育场馆", True),
    ("tourism", "aquarium"):         ("🏟 场馆 / 运动", "水族馆", True),
    # 必须排在最后：同一个要素若既是公园又标了 attraction，应归到公园。
    ("tourism", "attraction"):       ("🧭 特色去处", "特色地点", True),
}

# 按名字排除的噪声：街边自助借书机、无人值守阅读空间不是「去处」。
NAME_NOISE = ["自助图书馆", "智能文化空间", "自助借阅", "图书借阅机", "新华书店"]

# 名字就是个品类词，等于没名字——推荐里出现一条「美术馆」毫无用处。
GENERIC_NAMES = {"美术馆", "博物馆", "图书馆", "画廊", "艺术中心", "剧场",
                 "展览馆", "纪念馆", "体育馆", "公园", "校史馆", "正殿"}

# ---- 商场的筛选 ----
# 北京标了 shop=mall 的有 199 家，绝大多数是方庄购物中心、NTP新城广场、时代Life
# 这类社区商场，没人会为它专程坐地铁。用户给的判据是「商铺多、评价过万」或
# 「在华外国人中有名气」——OSM 两样数据都没有，但 name:en 是后者的好代用品：
# 实测该留的 7/11 有英文名，该砍的 8/8 一个都没有。有人愿意给它填英文名的商场，
# 恰恰就是外国人会去的那种。
#
# 只靠 name:en 会漏掉标签极稀疏的大商场（颐堤港只有 2 个标签），故再加一张
# 品牌白名单兜底；另排除批发市场与建材家居城——它们是 shop=mall 但不是去处。
MALL_BRANDS = ["大悦城", "万象", "合生汇", "SKP", "颐堤港", "银泰", "爱琴海", "太古",
               "恒隆", "国贸", "侨福", "华贸", "蓝色港湾", "天街", "荟聚", "apm",
               "来福士", "新光天地", "王府中环", "东方新天地", "世贸天阶", "富力广场",
               "悠唐", "三里屯", "凯德", "万达广场", "新中关", "蓝港", "朝阳", "西单",
               "五道口"]
MALL_EXCLUDE = ["批发", "折扣仓", "红星美凯龙", "建材", "家居", "茶城", "工艺品",
                "五金", "机电", "汽配", "果蔬", "粮油", "水产", "宠物", "图书大厦",
                "超市", "便利"]


def mall_is_destination(name):
    if any(word in name for word in MALL_EXCLUDE):
        return False
    return any(brand in name for brand in MALL_BRANDS)


# ---- 博物馆细分 ----------------------------------------------------------
# OSM 的 tourism=museum 只到「博物馆」这一层，不区分军事/民俗/科技。周末方案
# 里有 12 条细分博物馆玩法，全挂同一个 subtype 的后果是：抽到「军事博物馆」
# 挂上来的是北京人艺戏剧博物馆。馆名本身带着类别信息，按名字分最省事。
#
# 顺序即优先级，先匹配到的先算。

MUSEUM_NOISE = [
    r"校史馆$", r"^校友之家$", r"^图书馆$", r"^钟表馆$", r"茗茶", r"茶社",
    r"^书画频道$", r"^排云殿$", r"^石道碑$", r"^大慧寺$", r"^植物标本馆$",
    r"乡史", r"场史馆", r"院史馆", r"展陈室", r"^南苑乡文化娱乐中心$",
    r"^秀池水下展厅$", r"^中国当代艺术档案$",
]

MUSEUM_RULES = [
    ("汽车博物馆",    r"汽车"),
    ("军事博物馆",    r"军事|抗日战争|坦克|民兵|武器装备|国防|中国航空博物馆"),
    ("自然博物馆",    r"自然|古动物|古植物|地质|冰川|动物博物馆|蜜蜂"),
    ("食物博物馆",    r"农业|粮食|西瓜|饲料|葡萄酒"),
    ("工业博物馆",    r"石化|高炉|化工|印刷|燕山|工业"),
    ("科技博物馆",    r"科技|科学技术|航空|航天|民航|铁道|铁路|电信|核工业|公交|地铁|热气球|冬奥|奥运工程"),
    ("规划展览馆",    r"规划|城市副中心|新区"),
    ("艺术博物馆",    r"美术|艺术|石刻|电影"),
    ("民俗博物馆",    r"民俗|民族|非遗|胡同|戏曲|香会|紫檀|红木|木作|老窑瓷|百工|人偶|蜡像"),
    ("历史博物馆",    r"革命|二七|党|地下交通线"),          # 革命纪念馆归历史，不归故居
    ("故居 / 纪念馆", r"故居|祠$|纪念馆|纪念堂|^鲁迅博物馆$|学社"),
    ("历史博物馆",    r"历史|考古|遗址|古代|钱币|档案|故城|城墙|大运河|海关|华侨|旧址"
                      r"|文学馆|典籍|版本馆|方志|故宫|Palace Museum|国家博物馆|首都博物馆|王府|博物院"),
    ("规划展览馆",    r"展览馆|展示中心|展厅|展览$"),
]

# 「奇趣」是判断，不是关键词算得出来的，单列名单。它会盖掉上面的分类——
# 中国西瓜博物馆归「冷门 / 奇趣」比归「食物」更贴近用户抽到它时的预期。
MUSEUM_QUIRKY = {
    "中国西瓜博物馆", "中国蜜蜂博物馆", "中国人偶博物馆", "热气球博物馆",
    "北京松堂博物馆", "活的3D博物馆", "英杰硬石博物馆", "老窑瓷博物馆",
    "文旺阁木作博物馆", "百工博物馆", "北京十三陵明皇蜡像宫", "中国古植物馆",
    "中国农业大学饲料博物馆", "白纸坊街道纸文化博物馆", "崇德堂博物馆",
}


def museum_subtype(name):
    """返回细分 subtype；返回 None 表示这条根本不是博物馆，丢掉。"""
    for pattern in MUSEUM_NOISE:
        if re.search(pattern, name):
            return None
    if name in MUSEUM_QUIRKY:
        return "冷门 / 奇趣博物馆"
    for label, pattern in MUSEUM_RULES:
        if re.search(pattern, name):
            return label
    return "综合博物馆"


def has_quality_signal(tags):
    """有人愿意为它填维基条目、官网、门票或营业时间，通常说明它值得专门去一趟。"""
    return bool(tags.get("wikidata") or tags.get("wikipedia") or tags.get("website")
                or tags.get("contact:website") or tags.get("fee")
                or tags.get("opening_hours")) or len(tags) >= 6


def build_query(tags, require_any=None, label=None):
    """按分组拼查询。RAW_QUERY 里的分组用自带的完整查询（需要正则匹配名字）；
    require_any 非空时，为每个「必须存在的标签」各生成一条子句（Overpass 端过滤）。"""
    if label in RAW_QUERY:
        return RAW_QUERY[label] % {"brands": RETAIL_BRANDS, "bbox": BBOX}
    clauses = []
    for key, value in tags:
        if require_any:
            for extra in require_any:
                clauses.append('  nwr["%s"="%s"]["name"]["%s"](%s);' % (key, value, extra, BBOX))
        else:
            clauses.append('  nwr["%s"="%s"]["name"](%s);' % (key, value, BBOX))
    return "[out:json][timeout:180];\n(\n%s\n);\nout center tags;\n" % "\n".join(clauses)


class RateLimited(Exception):
    """Overpass 明确要求退让，应当停止本次全部后续请求。"""


def fetch_group(label, tags, attempt=1):
    request = urllib.request.Request(
        OVERPASS,
        data=urllib.parse.urlencode(
            {"data": build_query(tags, REQUIRE_ANY.get(label), label)}).encode(),
        headers={"User-Agent": UA},
    )
    started = time.time()
    try:
        with urllib.request.urlopen(request, timeout=240) as response:
            raw = response.read()
        print("  ✅ %-12s %.1fs  %d KB" % (label, time.time() - started, len(raw) // 1024))
        return raw
    except urllib.error.HTTPError as e:
        if e.code == 429:
            raise RateLimited(label)
        print("  ❌ %-12s HTTP %s %s" % (label, e.code, e.reason))
        return None
    except Exception as e:
        # 传输中断是链路问题，重试一次；再失败就放弃这一组
        if attempt == 1:
            print("  ⚠️  %-12s %s，传输中断，隔 10s 重试一次" % (label, type(e).__name__))
            time.sleep(10)
            return fetch_group(label, tags, 2)
        print("  ❌ %-12s 两次均失败，跳过" % label)
        return None


def collect(force=False, offline=False):
    os.makedirs(CACHE, exist_ok=True)
    raws, missing = {}, []
    pending = []
    for label in GROUPS:
        path = os.path.join(CACHE, "poi_%s.json" % label)
        if os.path.exists(path) and not force:
            raws[label] = open(path, "rb").read()
            print("  📁 %-12s 用缓存" % label)
        elif offline:
            missing.append(label)
        else:
            pending.append(label)

    for i, label in enumerate(pending):
        if i:
            time.sleep(GAP_SECONDS)
        try:
            raw = fetch_group(label, GROUPS[label])
        except RateLimited:
            print("  ⛔ %-12s HTTP 429 —— 服务端要求退让，本次停止抓取剩余分组" % label)
            missing.extend(pending[i:])
            break
        if raw is None:
            missing.append(label)
            continue
        open(os.path.join(CACHE, "poi_%s.json" % label), "wb").write(raw)
        raws[label] = raw
    return raws, missing


def parse(raws):
    pois, seen = [], set()
    for raw in raws.values():
        for element in json.loads(raw.decode("utf-8"))["elements"]:
            tags = element.get("tags") or {}
            name = (tags.get("name") or "").strip()
            # OSM 里一个地方有两个名字时会用分号拼起来，取第一个就够了。
            if ";" in name:
                name = name.split(";")[0].strip()
            if name in GENERIC_NAMES:
                continue
            lat, lon = element.get("lat"), element.get("lon")
            if lat is None and element.get("center"):
                lat, lon = element["center"]["lat"], element["center"]["lon"]
            if not name or lat is None:
                continue
            category = subtype = None
            for key, value in CATEGORY.items():
                if tags.get(key[0]) == key[1]:
                    category, subtype, strict = value
                    if key in STRICT_SIGNAL and not has_site_signal(tags):
                        category = None
                    elif key in PARK_TAGS and not has_landmark_signal(tags):
                        category = None
                    elif strict and not has_quality_signal(tags):
                        category = None
                    elif any(word in name for word in CHAIN_KEYWORDS):
                        category = None
                    elif any(word in name for word in NAME_NOISE):
                        category = None
                    elif key == ("shop", "mall") and not (
                            mall_is_destination(name) or tags.get("name:en")
                            or tags.get("wikidata") or tags.get("wikipedia")
                            or tags.get("brand") or tags.get("operator")):
                        category = None
                    break
            if not category:
                continue
            if subtype == "博物馆":
                subtype = museum_subtype(name)
                if not subtype:
                    continue
            osm_id = "%s/%s" % (element["type"], element["id"])
            if osm_id in seen:
                continue
            seen.add(osm_id)
            pois.append({
                "id": osm_id,
                "name": name,
                "category": category,
                "subtype": subtype,
                "latitude": round(lat, 6),
                "longitude": round(lon, 6),
                "source_url": "https://www.openstreetmap.org/%s/%s" % (element["type"], element["id"]),
                "website": tags.get("website") or tags.get("contact:website") or None,
                "opening_hours": tags.get("opening_hours") or None,
                "tag_count": len(tags),
            })
    pois.sort(key=lambda p: (p["category"], p["name"]))
    return dedupe_malls(dedupe_same_name(pois))


# 同一个商圈在 OSM 里常被切成好几块：三里屯太古里分南/北/西区，华贸有中心、
# 购物中心、天地三条，THE BOX 还多一个 B 座；而颐堤港、SKP、侨福芳草地
# 既有 shop=mall 的点也有 landuse=retail 的面。按名字归并，只留标签最全的那条，
# 否则一个站的推荐里会出现三次太古里。
MALL_SUFFIXES = ["南区", "北区", "西区", "东区", "中区", "B座", "A座", "一期", "二期", "三期",
                 "步行街", "购物中心", "商场", "中心", "广场"]


def haversine_m(lat1, lon1, lat2, lon2):
    r = math.radians
    d_lat, d_lon = r(lat2 - lat1), r(lon2 - lon1)
    h = math.sin(d_lat / 2) ** 2 + math.cos(r(lat1)) * math.cos(r(lat2)) * math.sin(d_lon / 2) ** 2
    return 6371000 * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))


# 这些品牌在北京只有一处，但 OSM 里被切成了好几条（「合生汇」「北京朝阳合生汇」
# 「北京超极合生汇（东区）」是同一个地方）。按品牌直接归并。
# 注意不能对「大悦城」「万达广场」这类做同样处理——它们在北京确实有多家。
SINGLE_LOCATION_BRANDS = ["合生汇", "太古里", "THE BOX", "颐堤港", "蓝色港湾", "SOLANA",
                          "芳草地", "王府中环", "世贸天阶", "来福士", "新光天地"]


def mall_key(name):
    for brand in SINGLE_LOCATION_BRANDS:
        if brand in name:
            return brand
    key = re.sub(r"[（(].*?[)）]", "", name).strip()
    changed = True
    while changed:
        changed = False
        for suffix in MALL_SUFFIXES:
            if key.endswith(suffix) and len(key) > len(suffix) + 1:
                key = key[: -len(suffix)].strip()
                changed = True
    return key.replace("北京", "").strip() or name


# 同名且挨得很近的，是同一个地方在 OSM 里被标了好几次（抗日战争纪念馆、
# 国家版本馆、铁道博物馆东郊展馆都有两条；元大都城垣遗址公园被切成了好几段）。
# 不能按名字一刀切——万达影城、保利影院的分店同名但确实是不同的地方。
# 只合并 800 米以内的，保留标签多的那条。
def dedupe_same_name(pois, radius_m=800):
    kept = []
    for poi in sorted(pois, key=lambda p: -p["tag_count"]):
        twin = next((k for k in kept
                     if k["name"] == poi["name"] and k["subtype"] == poi["subtype"]
                     and haversine_m(k["latitude"], k["longitude"],
                                     poi["latitude"], poi["longitude"]) <= radius_m), None)
        if twin is None:
            kept.append(poi)
    return kept


def dedupe_malls(pois):
    best, others = {}, []
    for poi in pois:
        if poi["category"] != "🛍 商场 / 商圈":
            others.append(poi)
            continue
        key = mall_key(poi["name"])
        kept = best.get(key)
        if kept is None or poi["tag_count"] > kept["tag_count"]:
            best[key] = poi

    merged = others + list(best.values())
    merged.sort(key=lambda p: (p["category"], p["name"]))
    for poi in merged:
        poi.pop("tag_count", None)
    return merged


def write_js(pois, missing):
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    by_category = Counter(p["category"] for p in pois)
    lines = []
    w = lines.append
    w("/**")
    w(" * 地铁站周边「值得专门去」的 POI，扁平列表，由前端按距离匹配到站点。")
    w(" *")
    w(" * 数据来源：OpenStreetMap contributors，经 Overpass API 查询获得。")
    w(" * 许可：ODbL 1.0 —— 使用须保留 © OpenStreetMap contributors 署名并履行 ODbL 义务。")
    w(" * 获取时间：%s" % now)
    w(" *")
    w(" * 共 %d 条：" % len(pois))
    for name, count in by_category.most_common():
        w(" *   %s  %d" % (name, count))
    if missing:
        w(" *")
        w(" * ⚠️ 本次未取到的分组：%s" % "、".join(missing))
        w(" *   （多因 Overpass 限流；重跑脚本会只补这些分组，已有缓存不会重复请求）")
    w(" *")
    w(" * 刻意不收餐厅、咖啡、泛化景点——理由见 tools/fetch_station_pois.py 的说明。")
    w(" * 公园与寺庙古迹额外过了一道质量筛（须有维基/官网/门票/营业时间，或标签足够丰富），")
    w(" * 否则会混入大量小区绿地与路边雕像。")
    w(" * 坐标为 WGS84，与 data/station_coordinates.js 同一坐标系。")
    w(" *")
    w(" * 本文件由 tools/fetch_station_pois.py 生成，不要手工编辑。")
    w(" */")
    w("export const nearbyPois = [")
    for p in pois:
        w("  { id: %s, name: %s, category: %s, subtype: %s, latitude: %s, longitude: %s, source_url: %s },"
          % (json.dumps(p["id"]), json.dumps(p["name"], ensure_ascii=False),
             json.dumps(p["category"], ensure_ascii=False), json.dumps(p["subtype"], ensure_ascii=False),
             p["latitude"], p["longitude"], json.dumps(p["source_url"])))
    w("];")
    w("")
    w("/** POI 来源署名，展示这些内容时应当带上。 */")
    w("export const poiSource = {")
    w('  name: "OpenStreetMap contributors",')
    w('  url: "https://www.openstreetmap.org/copyright",')
    w('  license: "ODbL 1.0",')
    w('  fetched_at: "%s",' % now)
    w("};")
    w("")
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description="抓取地铁站周边 POI")
    parser.add_argument("--rebuild", action="store_true", help="只用缓存重新生成，不联网")
    parser.add_argument("--force", action="store_true", help="忽略缓存，全部重抓")
    args = parser.parse_args()

    print("分组抓取（组间停顿 %ds，遇 429 立即停止）：" % GAP_SECONDS)
    raws, missing = collect(force=args.force, offline=args.rebuild)
    if not raws:
        raise SystemExit("一组都没取到，本次不生成文件。")

    pois = parse(raws)
    print()
    print("解析得到 %d 条 POI：" % len(pois))
    for name, count in Counter(p["category"] for p in pois).most_common():
        print("   %-16s %d" % (name, count))
    if missing:
        print()
        print("⚠️ 未取到的分组：%s —— 稍后重跑脚本即可只补这些" % "、".join(missing))

    write_js(pois, missing)
    print()
    print("已写出：%s" % OUT)


if __name__ == "__main__":
    main()
