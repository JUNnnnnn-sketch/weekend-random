import { experiences } from "./data/experiences.js";
import { stationCoordinates } from "./data/station_coordinates.js";
import { nearbyPois } from "./data/station_pois.js";

const DAY = 24 * 60 * 60 * 1000;

export function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }

/**
 * 坐标只认 data/station_coordinates.js（来自 OSM，WGS84），不回退到 subway.js 里的值。
 *
 * 原因：Excel 带来的那 20 条坐标经比对确认是 GCJ-02（把 OSM 的 WGS84 做一次
 * WGS84->GCJ-02 变换后，与 Excel 值的平均差距从 499 m 降到 76 m），与 OSM 的
 * WGS84 不是同一个坐标系。两者混用会在那几个站上引入约 500 m 的系统性误差，
 * 足以毁掉按距离做的“附近有什么”。宁可缺坐标，也不要混坐标系。
 */
function coordinatesOf(station) {
  const hit = stationCoordinates[station.physical_station_id];
  return hit ? { latitude: hit.latitude, longitude: hit.longitude } : { latitude: null, longitude: null };
}

/**
 * 命运模式的覆盖范围：距市中心（天安门）这个公里数以内的车站。
 *
 * 为什么要划范围：远郊站周边几乎没有可推荐的地方（12km 以外只有约 48% 的站
 * 能找到内容，20km 以外只有 29%），不设范围的话超过一半的抽签会落空。
 * 划定范围不是把骰子做手脚——范围公开写在界面上，范围之内仍是真随机。
 *
 * 8 km 覆盖 121 个站，其中 93% 能给出附近推荐，是覆盖面与命中率的平衡点。
 */
const CITY_CENTER = { latitude: 39.9087, longitude: 116.3975 };
export const FORTUNE_SCOPE_KM = 8;
export const NEARBY_RADIUS_KM = 1.2;

function inFortuneScope(station) {
  const hit = stationCoordinates[station.physical_station_id];
  return Boolean(hit) && distanceKm(CITY_CENTER, hit) <= FORTUNE_SCOPE_KM;
}

/** 把线路裁剪到覆盖范围内；裁剪后没有站的线路整条去掉。 */
export function fortuneScopeLines(lines) {
  return lines
    .map((line) => ({ ...line, stations: (line.stations || []).filter(inFortuneScope) }))
    .filter((line) => line.stations.length);
}

/**
 * 命运模式的随机阶段：只决定“去哪”。
 * 在覆盖范围内随机一条真实线路 -> 随机该线路上的一个真实站点。
 * 这里不做任何“附近有什么”的筛选，那是独立的后续阶段。
 */
export function pickDestination(lines) {
  const usable = fortuneScopeLines(lines);
  if (!usable.length) return null;
  const line = randomItem(usable);
  const station = randomItem(line.stations);
  const { latitude, longitude } = coordinatesOf(station);
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
      latitude,
      longitude,
      has_coordinates: latitude !== null && longitude !== null,
      coordinate_source: latitude !== null ? "OpenStreetMap contributors (ODbL 1.0)" : null,
      name: station.station_name,
      label: `${line.line_name} · ${station.station_name}`,
    },
  };
}

/**
 * 「附近有什么」阶段：找出目的地周边的真实场所，按距离升序。
 *
 * 结果是稳定的——同一个站每次返回同样的清单。随机性已经在上一步
 * “命运把你送到哪一站”里用掉了，附近推荐本来就不该每次都变。
 *
 * 没有坐标、或周边确实没有收录的场所时，返回空数组。不扩大半径去凑数。
 */
export function findNearbyPois(destination, { radiusKm = NEARBY_RADIUS_KM } = {}) {
  if (!destination || destination.latitude === null || destination.longitude === null) return [];
  return nearbyPois
    .map((poi) => ({ ...poi, distance_km: distanceKm(destination, poi) }))
    .filter((poi) => poi.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km);
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

// 每个时长档位的总时间预算（分钟上限），用于可行性校验（support 不能让总时间明显超预算）。
const DURATION_BUDGET = {
  "2-3小时": 180,
  "半天": 300,
  "一整天": 600,
};

// 每个时长档位允许出现的 duration_type。multi_day 在任何 MVP 档位都不参与（需住宿的京郊目的地直接排除）。
const ALLOW_TYPE = {
  "2-3小时": ["short"],
  "半天": ["short", "half_day"],
  "一整天": ["short", "half_day", "full_day"],
};

// 地点兼容：避免让用户在城市与京郊之间来回跑。任一方为 both 则互通；否则必须同 scope。
function compatibleScope(a, b) {
  if (a.location_scope === "both" || b.location_scope === "both") return true;
  return a.location_scope === b.location_scope;
}

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
 * 新增两层约束（与 buildWeekendPlan 共用，保证「换一个」也遵循同一套可行性规则）：
 *   - duration_type 必须属于本档位允许的集合（multi_day 在任何档位都被排除）。
 *   - suburban（京郊）Experience 只在「一整天」进入候选；2-3小时 / 半天完全不出现京郊。
 * 返回真实存在于 data/experiences.js 的 Experience 对象，不自行生成任何名称。
 */
export function filterExperiences({ people, duration, locationScope } = {}) {
  const code = peopleCodeOf(people);
  const win = DURATION_WINDOW[duration] || [0, Number.MAX_SAFE_INTEGER];
  const allowType = ALLOW_TYPE[duration] || ["short"];
  const suburbanAllowed = duration === "一整天";
  const supportCap = Math.min(win[1], 240);
  const core = [];
  const support = [];
  for (const exp of experiences) {
    if (!exp.suitable_people.includes(code)) continue;
    if (!scopeMatch(exp, locationScope)) continue;
    if (exp.role === "support") {
      if (!allowType.includes(exp.duration_type)) continue;
      if (exp.duration_max <= supportCap) support.push(exp);
    } else {
      if (!allowType.includes(exp.duration_type)) continue;            // 排除 multi_day / 不匹配时长档
      if (exp.location_scope === "suburban" && !suburbanAllowed) continue; // 京郊仅「一整天」
      if (exp.duration_type !== "full_day" && exp.duration_max > win[1]) continue; // 非整日玩法不能超过本档上限
      if (durationOverlap(exp.duration_min, exp.duration_max, win)) core.push(exp);
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
 * 构建一个「现实中可以完成」的周末计划（结构化数据，不触碰 UI）。
 *
 * 设计原则（可行性 > 丰富度）：
 *   1. 先筛合法 core，再判断它是 short / half_day / full_day / multi_day。
 *   2. multi_day 任何档位都不参与；京郊(suburban)只在「一整天」出现，且作为完整出行场景。
 *   3. full_day core 或 combinable:false 的 core 单独成方案（情况A），不强行叠加。
 *   4. 其余情况在「剩余时间预算」内尝试补充，且补充项必须与 primary core 地点兼容、不超时。
 *   5. 宁可少一张卡，也不生成明显不合理的行程。
 *
 * 接口保持稳定：{ people, duration, locationScope, exclude } -> { people, duration, locationScope, structure, experiences, empty }
 */
export function buildWeekendPlan({ people, duration, locationScope, exclude = [] } = {}) {
  const ctx = { people, duration, locationScope: locationScope || "both" };
  const budget = DURATION_BUDGET[duration] ?? Number.MAX_SAFE_INTEGER;
  const { core: corePool, support: supportPool } = filterExperiences({ people, duration, locationScope });
  const used = new Set(exclude);
  const candidateCores = corePool.filter((e) => !used.has(e.id));
  if (!candidateCores.length) {
    return { ...ctx, structure: { type: "empty", moduleCount: 0 }, experiences: [], empty: true };
  }
  const plan = [randomItem(candidateCores)];
  used.add(plan[0].id);

  // 2-3小时：一个 short core 即成立，不强行加 support。
  if (duration === "2-3小时") return finalize(plan, ctx, "single_core");
  // full_day core 或不可组合的 core：单独成方案（情况A）。
  if (plan[0].duration_type === "full_day" || plan[0].combinable === false) {
    return finalize(plan, ctx, plan[0].duration_type === "full_day" ? "full_day_core" : "non_combinable_core");
  }

  // 半天 / 一整天：在剩余预算内尝试补充（不强制），至多 2 个 core + 1 个 support。
  const MAX_MODULES = 3;
  let remaining = budget - plan[0].duration_max;
  let coreCount = 1;
  let supportCount = 0;
  let guard = 0;
  while (plan.length < MAX_MODULES && guard < 6) {
    guard += 1;
    if (remaining < 60) break;
    const primary = plan[0];
    const coreOpts = coreCount < 2
      ? corePool.filter((e) => e.id !== primary.id && !used.has(e.id) && compatibleScope(e, primary) && e.duration_max <= remaining)
      : [];
    const supOpts = supportCount < 1
      ? supportPool.filter((e) => !used.has(e.id) && compatibleScope(e, primary) && e.duration_max <= remaining)
      : [];
    let pick = null;
    if (coreOpts.length && remaining >= 180) pick = randomItem(coreOpts);
    else if (supOpts.length) pick = randomItem(supOpts);
    else if (coreOpts.length) pick = randomItem(coreOpts);
    else if (supOpts.length) pick = randomItem(supOpts);
    if (!pick) break;
    plan.push(pick);
    used.add(pick.id);
    remaining -= pick.duration_max;
    if (pick.role === "support") supportCount += 1; else coreCount += 1;
  }
  const type = plan.length >= 3 ? "multi_module"
    : plan.length === 2 && plan[1].role === "support" ? "core_support"
    : "multi_core";
  return finalize(plan, ctx, type);
}

function finalize(plan, ctx, type) {
  return { ...ctx, structure: { type, moduleCount: plan.length }, experiences: plan, empty: plan.length === 0 };
}
