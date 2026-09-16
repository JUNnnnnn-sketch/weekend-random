# Experience 字段说明（第一版）

本文档说明 `data/experiences.js` 中每个 Experience 的字段含义与合法取值。

> **Experience 是什么**：一类「周末值得为了它出门的玩法」本身（如「陶艺」「密室逃脱」）。
> 它**不是**具体地点（Place，如「XX 陶艺工作室」），也**不是**具体活动（Activity，如「2026-09-20 XX 陶艺体验课」）。
> 本文件是产品设计词典 / 玩法分类法（taxonomy），不含实时营业时间、地址、价格。

---

## 字段总表

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 唯一英文 slug，如 `pottery` |
| `name` | string | ✅ | 玩法中文名 |
| `main_type` | string | ✅ | 一级分类（见下） |
| `sub_type` | string | ✅ | 二级细分描述 |
| `role` | enum | ✅ | `core` / `support` |
| `duration_min` | int(分钟) | ✅ | 最短时长（真实分钟，非短/中/长） |
| `duration_max` | int(分钟) | ✅ | 最长时长，须 ≥ `duration_min` |
| `suitable_people` | string[] | ✅ | 适合人数，见枚举 |
| `location_scope` | enum | ✅ | `urban` / `suburban` / `both` |
| `vibe` | string[] | ✅ | 氛围标签，可多选，见枚举 |
| `physical_demand` | enum | ✅ | `low` / `medium` / `high` |
| `excitement` | int(0–3) | ✅ | 刺激程度（描述，非排名） |
| `season` | enum | ✅ | 见枚举 |
| `reservation_required` | bool | ✅ | 是否需要提前预约 |
| `first_time_friendly` | bool | ✅ | 是否适合第一次尝试 |
| `requirements` | string[] | ✅ | 现实约束标签（无则 `[]`） |
| `combinable` | bool | ✅ | 能否与其他玩法组合 |
| `novelty` | enum | ✅ | `normal` / `special` / `niche` / `weird` |

---

## 枚举取值

### `role`
- `core`：可单独构成一次 2–3 小时出门的核心玩法。
- `support`：通常 1–2 小时，作为搭配（如下午茶、看夜景、野餐、散步），不应单独承担「一整天」。

### `suitable_people`（仅以下四种组合合法）
- `["1"]` — 仅适合独自
- `["2"]` — 仅适合两人
- `["2","3+"]` — 适合两人或一群
- `["1","2","3+"]` — 任意人数

> 不把人数硬绑定到具体场所；例如陶艺可 `["1","2","3+"]`，卡丁车可 `["2","3+"]`。

### `location_scope`
- `urban` — 城区内即可
- `suburban` — 默认在京郊 / 近郊
- `both` — 城区或郊区都有

### `vibe`（可多选）
`young` / `social` / `romantic` / `chill` / `wild` / `weird` / `aesthetic` / `nostalgic` / `nerdy` / `high_energy` / `creative` / `immersive` / `outdoors` / `night`

### `physical_demand`
- `low` / `medium` / `high`

### `excitement`
- `0`：静态放松（看夜景、野餐、下午茶、按摩）
- `1`：轻度（陶艺、花艺、博物馆、保龄球）
- `2`：中等（密室、卡丁车、Live House、徒步、攀岩）
- `3`：高刺激（蹦迪、音乐节、漂流、演唱会、赛车观赛）

### `season`
- `all_year` / `spring` / `summer` / `autumn` / `winter` / `seasonal`

### `novelty`
- `normal` — 常规玩法
- `special` — 有特色 / 节点型（温泉、音乐节、马术观赛）
- `niche` — 小众（小众展览、跑团、桨板、壁球、匹克球）
- `weird` — 偏怪奇（奇趣博物馆、奇怪的主题展览、冷门类）

---

## `requirements` 标签约定（现实约束，布尔式存在）

用于表达「该玩法在现实中需要满足的前置条件」，**不要写成描述性句子**（如不要写「附近有河所以可以钓鱼」）。

第一版已使用的标签：

| 标签 | 含义 | 示例玩法 |
|---|---|---|
| `fishing_allowed` | 该地允许垂钓 | 钓鱼 |
| `camping_allowed` | 该地允许露营 | 露营、野营过夜 |
| `overnight_allowed` | 允许过夜 | 野营过夜 |
| `boat_rental_available` | 有船可租 | 划船 |
| `public_experience_available` | 有对公众开放的体验 | 骑马体验 |
| `season_open` | 当季开放 | 漂流、采摘 |
| `water_open` | 水域开放 | 桨板、水上运动 |
| `rental_available` | 器材可租 | 桨板、水上运动 |
| `trail_open` | 步道/山路开放 | 徒步、爬山 |
| `farm_open` | 农场开放采摘 | 采摘 |
| `park_open` | 公园可入 | 野餐 |
| `track_open` | 卡丁车赛道营业 | 卡丁车 |
| `wall_open` | 攀岩墙营业 | 攀岩 |
| `range_license_ok` | 持合法资质可体验 | 射击体验 |
| `public_bath_available` | 有公共浴场 | 温泉 |
| `clear_weather` | 需晴朗天气 | 看日落、看日出、观星 |
| `low_light_pollution` | 需低光污染 | 观星 |
| `event_scheduled` | 需有赛事/演出排期 | 各类观赛、演唱会、音乐节 |

> 未来接入地点库（Place）后，可用 Place 的属性去匹配这些标签，判断某玩法在该地点是否可行。

---

## `main_type` 一级分类（第一版共 9 类）

1. 音乐/舞台/夜生活
2. 手作/体验
3. 游戏/轻刺激
4. 放松
5. 自然/户外
6. 乐园/大型目的地
7. 文化/奇趣探索
8. 城市探索
9. 赛事/观赏

---

## 组合（combinable）原则

- `support` 类默认可组合，作为 `core` 前后的搭配：下午茶、鸡尾酒、酒吧、看夜景、看日落、散步、野餐、城市探索短路线。
- `core` 多数为 `combinable: true`；大型/全天型（游乐园、主题公园、露营过夜、音乐节、各类观赛）设为 `combinable: false`，因为它们自身就能占满半天到一整天。
- 未来排程可生成：`core + support + core`（如 陶艺 → 下午茶 → 看夜景）。

---

## 明确不进入第一版核心池的内容

以下属于「普通生活消费」，最多作为 support 候选，不建为独立 Experience：
- 普通吃饭（如「吃顿饭」）
- 普通咖啡（如「喝杯星巴克」）
- 普通购物 / 普通逛商场

> 「下午茶」「鸡尾酒」「酒吧」因带有明确的「出门口子 / 社交场景」，作为 support 录入；但「星巴克」这类具体门店不是 Experience。

---

## 补充约定

- **不写主观评分**：本文件不含 `best_score` / `popularity_score` / `quality_score`。`excitement` / `physical_demand` / `novelty` / `first_time_friendly` 仅为描述性属性，不用于排名。
- **博物馆细分**：文化类下已细分艺术/历史/科技/自然/军事/汽车/工业/食物/民俗/奇趣/冷门/综合等，并保留 `weird` / `niche` 的 `novelty`，以便未来支持「给我一个普通博物馆」或「给我一个很奇怪的博物馆」。
- **时长用真实分钟**：如 下午茶 60–120、陶艺 120–180、密室 120–180、Live House 120–240、温泉/汤泉 240–480、游乐园 360–720、露营 360–2880。不虚构具体营业时间。
- **后续扩展**：新增玩法时保持 18 个字段结构一致即可，无需改动本说明之外的逻辑。
