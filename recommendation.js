import { experiences } from "./data/experiences.js";

const DAY = 24 * 60 * 60 * 1000;

export function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }

/**
 * 命运模式的随机阶段：只决定“去哪”。
 * 随机一条真实线路 -> 随机该线路上的一个真实站点。
 * 完全不依赖坐标：latitude/longitude 为 null 的站点同样可以被抽中。
 * 这里不做任何“附近有什么”的筛选，那是独立的后续阶段。
 */
export function pickDestination(lines) {
  const usable = lines.filter((line) => line.stations && line.stations.length);
  if (!usable.length) return null;
  const line = randomItem(usable);
  const station = randomItem(line.stations);
  return {
    line,
    station,
    destination: {
      kind: "station",
      line_id: line.line_id,
      line_name: line.line_name,
      station_id: station.station_id,
      physical_station_id: station.physical_station_id,
      station_name: station.station_name,
      station_order: station.station_order,
      latitude: station.latitude,
      longitude: station.longitude,
      has_coordinates: station.latitude !== null && station.longitude !== null,
      name: station.station_name,
      label: `${line.line_name} · ${station.station_name}`,
    },
  };
}

export function distanceKm(a, b) {
  const rad = (value) => (value * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude); const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function activityStatus(activity, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (new Date(activity.end_date) < today) return "已结束";
  if (new Date(activity.start_date) > today) return "即将开始";
  return "正在进行";
}

export function freshness(updatedAt, now = new Date()) {
  const ageDays = Math.max(0, (now - new Date(updatedAt)) / DAY);
  if (ageDays <= 1) return "24小时内更新";
  if (ageDays <= 3) return "3天内更新";
  if (ageDays <= 7) return "7天内更新";
  return "超过7天";
}

function freshnessScore(updatedAt, now) { return { "24小时内更新": 4, "3天内更新": 3, "7天内更新": 2, "超过7天": 1 }[freshness(updatedAt, now)]; }
function radiusFor(duration) { return { "2-3小时": 2, "半天": 5, "一整天": 12 }[duration]; }

/**
 * “附近有什么”阶段：真地点 -> 人数 -> 时长 -> 去掉已结束活动 -> 距离/新鲜度排序 -> 从优先候选池随机抽取。
 * 依赖 destination 的坐标，目前只由“随便逛逛”模式调用；命运模式的抽签不经过这里。
 */
export function recommend({ destination, people, duration, places, activities, now = new Date() }) {
  const radius = radiusFor(duration);
  const items = [
    ...places.map((place) => ({ ...place, type: "place" })),
    ...activities.filter((activity) => activityStatus(activity, now) !== "已结束").map((activity) => ({ ...activity, type: "activity" })),
  ];
  const candidates = items
    .filter((item) => item.suitable_for_people.includes(people))
    .filter((item) => item.suitable_duration.includes(duration))
    .map((item) => ({ ...item, distance_km: distanceKm(destination, item) }))
    .filter((item) => item.distance_km <= radius)
    .sort((a, b) => a.distance_km - b.distance_km || freshnessScore(b.updated_at, now) - freshnessScore(a.updated_at, now));
  const topPool = candidates.slice(0, Math.max(1, Math.ceil(candidates.length * 0.6)));
  return { candidates, picks: topPool.length ? [randomItem(topPool)] : [], radius };
}

// ============================================================
//  Experience 推荐（独立于地铁/附近的玩法词典逻辑）
//  数据来源：data/experiences.js（玩法本体，非地点、非活动）
//  说明：本段只做「结构化筛选 + 组合」，不接入 UI、不联网、不调用外部 API。
// ============================================================

// people：接受中文 party（"一个人"/"两个人"/"一群人"，与 schema.supportedPeople 一致）
//         也可直接传 experiences 编码（"1"/"2"/"3+"）。
const PEOPLE_CODE = { "一个人": "1", "两个人": "2", "一群人": "3+" };

// duration：接受 schema.supportedDurations 的中文档位，映射为「分钟窗口」[min, max]。
const DURATION_WINDOW = {
  "2-3小时": [120, 180],
  "半天": [180, 300],
  "一整天": [300, 600],
};

// 三种时长的组合结构：core = 核心玩法，support = 辅助玩法。
const PLAN_STRUCTURE = {
  "2-3小时": { core: 1, support: 0 },
  "半天": { core: 1, support: 1 },
  "一整天": { core: 2, support: 1 },
};

function peopleCodeOf(people) { return PEOPLE_CODE[people] ?? people; }

// locationScope 匹配：用户要 urban/suburban 时，both 类玩法都可入选；要 both 时全选。
function scopeMatch(exp, scope) {
  if (!scope || scope === "both") return true;
  return exp.location_scope === scope || exp.location_scope === "both";
}

// 时长重叠：玩法时长区间与档位窗口有交集即可。
function durationOverlap(min, max, win) { return min <= win[1] && max >= win[0]; }

/**
 * 按人数 / 时长 / 城市范围过滤 Experience，返回分离后的 core 与 support 候选池。
 * - core：时长须与本档窗口重叠，可单独构成主体活动。
 * - support：作为搭配，时长上限不超过本档窗口上限且不超过 240 分钟（短搭配）。
 * 返回真实存在于 data/experiences.js 的 Experience 对象，不自行生成任何名称。
 */
export function filterExperiences({ people, duration, locationScope } = {}) {
  const code = peopleCodeOf(people);
  const win = DURATION_WINDOW[duration] || [0, Number.MAX_SAFE_INTEGER];
  const supportCap = Math.min(win[1], 240);
  const core = [];
  const support = [];
  for (const exp of experiences) {
    if (!exp.suitable_people.includes(code)) continue;
    if (!scopeMatch(exp, locationScope)) continue;
    if (exp.role === "support") {
      if (exp.duration_max <= supportCap) support.push(exp);
    } else if (durationOverlap(exp.duration_min, exp.duration_max, win)) {
      core.push(exp);
    }
  }
  return { core, support };
}

/**
 * 从指定 role 的候选池中随机挑一个 Experience。
 * exclude：传入已出现过的 id 列表（可跨次传入上一次结果），尽量避免连续重复。
 * 若排除后仍为空，退化为忽略 exclude 从原池挑选，保证总能返回（或 null）。
 */
export function pickExperience({ people, duration, locationScope, role = "core", exclude = [] } = {}) {
  const { core, support } = filterExperiences({ people, duration, locationScope });
  const base = role === "support" ? support : core;
  const pool = base.filter((exp) => !exclude.includes(exp.id));
  if (!pool.length) return base.length ? randomItem(base) : null;
  return randomItem(pool);
}

/**
 * 构建一个周末计划（结构化数据，不触碰 UI）。
 * 组合结构由 duration 档位决定：
 *   - 2-3小时：1 个 core
 *   - 半天：    1 个 core + 1 个 support
 *   - 一整天：  2 个 core + 1 个 support
 * 同一计划内不重复选同一 Experience；exclude 可跨次传入以避免连续重复。
 */
export function buildWeekendPlan({ people, duration, locationScope, exclude = [] } = {}) {
  const struct = PLAN_STRUCTURE[duration] || PLAN_STRUCTURE["2-3小时"];
  const used = new Set(exclude);
  const picks = [];
  for (let i = 0; i < struct.core; i++) {
    const exp = pickExperience({ people, duration, locationScope, role: "core", exclude: [...used] });
    if (!exp) break;
    picks.push(exp);
    used.add(exp.id);
  }
  for (let i = 0; i < struct.support; i++) {
    const exp = pickExperience({ people, duration, locationScope, role: "support", exclude: [...used] });
    if (!exp) break;
    picks.push(exp);
    used.add(exp.id);
  }
  return {
    people,
    duration,
    locationScope: locationScope || "both",
    structure: struct,
    experiences: picks,
    empty: picks.length === 0,
  };
}
