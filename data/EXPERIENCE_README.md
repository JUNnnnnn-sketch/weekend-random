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
| `duration_type` | enum | ✅ | 占用时间等级：`short` / `half_day` / `full_day` / `multi_day`（推荐算法据此判断是否「强行组合」） |
| `suburban_special` | bool | ✅ | 该体验的吸引力是否明显依赖京郊环境/目的地属性（决定它属于「城市活动」还是「京郊出行场景」） |

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

### `duration_type`（占用时间等级，推荐算法据此决定是否组合）
- `short` — 短活动，通常可以与其他活动组合（如陶艺、看展、密室）。
- `half_day` — 半日活动（如徒步、采摘、植物园、派对），自身已占去约半天。
- `full_day` — 基本占据一整天，单独成方案即可（如温泉、滑雪、音乐节、游乐园、环球影城、大型乐园、露营）。
- `multi_day` — 需要超过一天 / 明显需要住宿（如野营过夜）。**当前 MVP 的三个档位（2-3小时 / 半天 / 一整天）都不参与**，直接排除，不硬塞进「一整天」。

> 判断原则：**先判断活动占用多少时间，再决定能不能组合，而不是为了凑够卡片数强行组合。**
> 温泉 / 汤泉 / 滑雪 / 音乐节 / 游乐园 / 大型乐园 / 环球影城 / 明显需住宿的京郊目的地，应判为 `full_day` 或 `multi_day`，不要为了凑组合继续叠加其他活动。

### `suburban_special`（京郊特色属性）
- `true` — 体验的吸引力明显依赖京郊环境 / 目的地属性，属于「京郊出行场景」：京郊采摘、京郊温泉、骑马、露营、漂流、山野徒步、滑雪、观星、郊区水上活动（桨板 / 摩托艇 / 帆板）、钓鱼、划船、看日出等。
- `false` — 虽然可能发生在京郊，但并不属于「京郊特色体验」（如卡丁车、城区汤泉、普通城市活动）。**不要因为它位于京郊，就把它变成「京郊特色」。**

> 核心原则：**京郊不是城市活动的一个组合条件，而是另一种完整的出行场景。** 京郊 Experience 当前只在「一整天」出现，且默认直接作为完整方案，不自动追加城市鸡尾酒 / 城市剧本杀 / 城市咖啡等 support。

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

## 组合（推荐算法）原则

> 可行性优先级高于丰富度。宁可少一张卡，也不要生成明显不合理的行程。

- **先筛合法 core，再判断占用时间**：core 的 `duration_type` 决定它能否被组合。`multi_day` 在任何 MVP 档位都不参与；`full_day` core（温泉、滑雪、音乐节、游乐园、环球影城、大型乐园、露营等）单独成方案，不强行叠加（`combinable: false` 的 core 同理）。
- **京郊是另一种完整出行场景**：`suburban` 类 Experience 只在「一整天」出现；一个京郊 `full_day` core 默认直接作为完整方案，不再追加 city-only support；京郊 core 如需搭配，也只允许地点兼容的（suburban / both）玩法，不让用户在城市与京郊之间来回跑。
- **`support` 必须站得住脚**：与 primary core 的 `location_scope` 不冲突、能在剩余时间预算内完成，否则不添加。
- **半天 / 一整天允许的合理情况**：
  - 情况 A：一个 `full_day` core（温泉 / 滑雪 / 音乐节 / 游乐园 / 环球影城 / 京郊采摘…）→ `1 个 core`。
  - 情况 B：两个较短 core 可组成一天（如 半日活动 + 半日活动），而非 全天活动 + 半日活动。
  - 情况 C：core + support，仅当确实存在时间余量时才允许。
- `support` 类默认可组合，作为 `core` 前后的搭配：下午茶、鸡尾酒、酒吧、看夜景、看日落、散步、野餐、城市探索短路线。
- 非原子条目已拆分：原 `水上运动（摩托艇/帆板等）` 已拆为独立的 `摩托艇` 与 `帆板`，一次随机出来的是用户能理解并执行的一件事。

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
