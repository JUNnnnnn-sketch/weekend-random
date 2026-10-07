import { experiences } from "./data/experiences.js";
import { stationCoordinates } from "./data/station_coordinates.js";
import { nearbyPois } from "./data/station_pois.js";
import { placeRuleFor, AREA_SUBTYPES } from "./experience_places.js";

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
 * 命运模式的覆盖范围由数据决定：附近有没有值得去的地方，而不是离天安门多远。
 *
 * 曾经用「距天安门 8 km」划范围，是个错误的代理指标——北京的好地方并非以
 * 天安门为圆心均匀分布。那条规则把整个海淀文化带切在了外面：清华东路西口
 * （周边 35 个）、圆明园（22）、北京大学东门（22）、五道口（21）、中关村（18）、
 * 奥林匹克公园（18）全部落选，而用户搜「五道口」搜不到正是因为这个。
 *
 * 现在只保留一条：周边 1.2 km 内至少有 MIN_NEARBY_COUNT 个可推荐的地方。
 * 这既是「值得送人过去」的定义，也自然排除了什么都没有的远郊站。
 */
export const NEARBY_RADIUS_KM = 1.2;

/**
 * 命运模式的候选站：有坐标，且该半径下附近确实有地方可去。
 *
 * 把「附近什么都没有」的站排除在抽签池外，而不是抽中了再告诉用户没有。
 * 范围的定义就是「附近有地方可去」，范围之内仍然是真随机。
 *
 * 按物理站去重后再抽，而不是先抽线路再抽站：后者会让范围内只剩两三站的
 * 线路（如 17 号线南段）权重被放大好几倍。换乘站也只算一个，不因为停靠
 * 多条线就更容易被抽中。
 *
 * 结果按半径缓存——lines 在本项目里恒为 subwayLines，无需纳入缓存键。
 */
const candidateCache = new Map();
export function fortuneCandidates(lines, { radiusKm = NEARBY_RADIUS_KM } = {}) {
  if (candidateCache.has(radiusKm)) return candidateCache.get(radiusKm);
  const byPhysical = new Map();
  lines.forEach((line) => {
    (line.stations || []).forEach((station) => {
      const coords = coordinatesOf(station);
      if (coords.latitude === null) return;
      if (findNearbyPois(coords, { radiusKm }).length < MIN_NEARBY_COUNT) return;
      const entry = byPhysical.get(station.physical_station_id) || { station, lines: [] };
      if (!entry.lines.includes(line)) entry.lines.push(line);
      byPhysical.set(station.physical_station_id, entry);
    });
  });
  const result = [...byPhysical.values()];
  candidateCache.set(radiusKm, result);
  return result;
}

/**
 * 命运模式的随机阶段：只决定“去哪”。
 * 在覆盖范围内随机一条真实线路 -> 随机该线路上的一个真实站点。
 * 这里不做任何“附近有什么”的筛选，那是独立的后续阶段。
 */
export function pickDestination(lines, { radiusKm = NEARBY_RADIUS_KM } = {}) {
  const candidates = fortuneCandidates(lines, { radiusKm });
  if (!candidates.length) return null;
  const entry = randomItem(candidates);
  const station = entry.station;
  const line = randomItem(entry.lines);          // 换乘站随机取一条线来展示
  const { latitude, longitude } = coordinatesOf(station);
  // 抽签动画的滚动池：只滚候选范围内的内容，不滚抽不到的东西
  const lineNames = [...new Set(candidates.flatMap((c) => c.lines.map((l) => l.line_name)))];
  const stationNames = [...new Set(
    candidates.filter((c) => c.lines.includes(line)).map((c) => c.station.station_name))];
  return {
    line,
    station,
    lineNames,
    stationNames,
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
export const MIN_NEARBY_COUNT = 3;

/**
 * 半径固定 1.2 km（约 15 分钟步行），不为了凑数放宽。
 *
 * 曾经试过「凑不够就逐级放宽到 3 km」，结果是没内容的站去蹭邻站：宋家庄推出
 * 2.4 km 外的方庄体育公园，而那儿根本不算方庄；27 个放宽过的站里有 23 个
 * 跟邻站的推荐重合，丽泽商务区和菜户营的清单完全一样。
 * 这个产品不是地图大合集——附近没有值得去的地方，就不该把这一站放进抽签池。
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

/**
 * 「值得专程去」：命运模式抽不到、又确实得专门跑一趟的地方。
 *
 * 1011 个收录的地方里有 333 个命运模式永远给不出来——要么周边没有够 3 个
 * 可推荐的地方（那一站进不了抽签池），要么离最近的站超过 1.2 km。
 * 三分之一的数据看不见，太浪费。
 *
 * 但这 333 个性质不一样：有 152 个其实就在站旁边两公里内，走走就到，
 * 说成「专程去」名不副实。所以只收离最近的地铁站 2 km 以上的那 181 个。
 *
 * 判定在运行时算，不写进数据文件：数据一变就自动跟着变，不会留下过期的标记。
 */
export const TRIP_MIN_KM = 2;

let tripCache = null;
export function worthATripPlaces(lines) {
  if (tripCache) return tripCache;
  const reachable = fortuneCandidates(lines).map((entry) => coordinatesOf(entry.station));
  // 算「最近的站有多远」要用全部有坐标的站，不只是抽签池里那些
  const seen = new Set();
  const allStations = [];
  lines.forEach((line) => (line.stations || []).forEach((station) => {
    if (seen.has(station.physical_station_id)) return;
    const coords = coordinatesOf(station);
    if (coords.latitude === null) return;
    seen.add(station.physical_station_id);
    allStations.push({ station_name: station.station_name, ...coords });
  }));

  tripCache = [];
  for (const poi of nearbyPois) {
    if (reachable.some((c) => distanceKm(c, poi) <= NEARBY_RADIUS_KM)) continue;
    let nearest = null;
    for (const station of allStations) {
      const km = distanceKm(station, poi);
      if (!nearest || km < nearest.distance_km) nearest = { station_name: station.station_name, distance_km: km };
    }
    if (!nearest || nearest.distance_km < TRIP_MIN_KM) continue;
    tripCache.push({ ...poi, nearest });
  }
  return tripCache;
}

/** 随机挑一个「值得专程去」的地方；exclude 传已经看过的 id。 */
export function pickWorthATrip(lines, { exclude = [] } = {}) {
  const pool = worthATripPlaces(lines).filter((poi) => !exclude.includes(poi.id));
  if (pool.length) return randomItem(pool);
  const all = worthATripPlaces(lines);
  return all.length ? randomItem(all) : null;
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
// 环节之间留的路上时间。
const TRANSIT_MINUTES = 30;

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
/**
 * 当前季节。玩法词典里的 season 字段一直存在，但代码从没用过——
 * 在只有抽象玩法的阶段这不要紧，有了真实地点就要紧了：
 * 一月份推「去钓鱼台撒起一把落叶」，或者七月推滑雪，都很荒唐。
 *
 * 只认 summer / autumn / winter / all_year，因为词典里就只有这四种
 * （没有只属于春天的玩法）。
 */
export function currentSeason(now = new Date()) {
  const month = now.getMonth() + 1;
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  if (month === 12 || month <= 2) return "winter";
  return "spring";
}

function inSeason(experience, season) {
  return !experience.season || experience.season === "all_year" || experience.season === season;
}

/**
 * combining：这批玩法会被拼成一个多环节行程，所以不要求单条玩法自己撑满档位。
 * 不开这个开关时，「一整天」只会留下 duration_max >= 300 的玩法——实测每站
 * 只剩植物园和动物园两条，排不出行程。
 */
export function filterExperiences({ people, duration, locationScope, combining = false, now = new Date() } = {}) {
  const code = peopleCodeOf(people);
  const season = currentSeason(now);
  const win = DURATION_WINDOW[duration] || [0, Number.MAX_SAFE_INTEGER];
  const allowType = ALLOW_TYPE[duration] || ["short"];
  const suburbanAllowed = duration === "一整天";
  const supportCap = Math.min(win[1], 240);
  const core = [];
  const support = [];
  for (const exp of experiences) {
    if (!exp.suitable_people.includes(code)) continue;
    if (!inSeason(exp, season)) continue;                 // 不当季的玩法不出现
    if (!scopeMatch(exp, locationScope)) continue;
    if (exp.role === "support") {
      if (!allowType.includes(exp.duration_type)) continue;
      if (exp.duration_max <= supportCap) support.push(exp);
    } else {
      if (!allowType.includes(exp.duration_type)) continue;            // 排除 multi_day / 不匹配时长档
      if (exp.location_scope === "suburban" && !suburbanAllowed) continue; // 京郊仅「一整天」
      if (combining) {
        if (exp.duration_min <= win[1]) core.push(exp);
        continue;
      }
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
  // 不可组合的 core：单独成方案。
  if (plan[0].combinable === false) {
    return finalize(plan, ctx, "non_combinable_core");
  }
  // full_day 的 core 占满了白天，但晚上还能接一段轻的——爬了一天山，晚上吃个饭
  // 喝一杯是成立的。原先直接单条返回，是「一整天反而最空」的主因之一。
  if (plan[0].duration_type === "full_day") {
    const tail = supportPool.filter((e) => !used.has(e.id) && compatibleScope(e, plan[0]));
    if (tail.length) plan.push(randomItem(tail));
    return finalize(plan, ctx, plan.length > 1 ? "full_day_core_support" : "full_day_core");
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

/* ========================= 给方案挂真实地点 ========================= */

/** 每种时长的起始时刻，用来排出先后顺序。 */
/** 在一批已按距离排好的 POI 里，挑出符合该玩法的那个。 */
function matchPlace(experience, pois, taken) {
  const rule = placeRuleFor(experience.name);
  if (!rule) return { mode: "none" };
  if (rule.mode === "area") {
    // 只认标成「街区 / 商圈」的——798、国子监、南锣鼓巷、各大商圈。
    // pois 已按距离排过，find 取到的就是最近的那一片。
    for (const subtype of AREA_SUBTYPES) {
      const area = pois.find((p) => p.subtype === subtype && !taken.has(p.id));
      if (area) return { mode: "area", place: area, hint: rule.hint };
    }
    return { mode: "none", hint: rule.hint };
  }
  const hit = pois.find((p) => rule.subtypes.includes(p.subtype) && !taken.has(p.id));
  return hit ? { mode: "anchor", place: hit } : { mode: "none" };
}

/**
 * 这条玩法在这批 POI 里能不能落地。
 * taken 是本次行程已经用掉的地点——同一个剧场不能既算「音乐厅」又算「京剧」，
 * 否则第二环会挂空。
 */
function placeableAt(experience, pois, taken = new Set()) {
  const rule = placeRuleFor(experience.name);
  if (!rule) return false;                         // 没登记地点规则的，周末方案不提供
  const free = pois.filter((p) => !taken.has(p.id));
  if (rule.mode === "area") return free.some((p) => AREA_SUBTYPES.includes(p.subtype));
  return free.some((p) => rule.subtypes.includes(p.subtype));
}

/** 某一站附近能落地的玩法，供界面「换一个」时限定范围。 */
export function placeableExperiencesAt(station, { people, duration, locationScope, role = "core", taken = [] } = {}) {
  const pois = findNearbyPois(coordinatesOf(station));
  const used = new Set(taken);
  const pools = filterExperiences({ people, duration, locationScope, combining: true });
  const pool = role === "support" ? pools.support : pools.core;
  return pool.filter((e) => placeableAt(e, pois, used));
}

/** 换玩法之后重新给这一环挂地点。 */
export function matchPlaceFor(experience, station, taken = new Set()) {
  const pois = findNearbyPois(coordinatesOf(station));
  const matched = matchPlace(experience, pois, taken);
  return { placeMode: matched.mode, place: matched.place || null, hint: matched.hint || null };
}

/**
 * 周末方案：在一片地方里排出 2-3 个有真实地点的环节。
 *
 * 关键是顺序——先看这一站附近有什么，再从「能落地的玩法」里抽，而不是先抽
 * 玩法再去找地点。后者是上一版的做法，结果是：104 条玩法里只有 51 条登记了
 * 地点规则，盲抽经常抽到「主题派对」「随机城区探索」这种只能写「地点你定」
 * 的；连映射正确的「蹦迪」也会因为那一站恰好没有夜店而落空。一个什么都没给
 * 的方案不如不给。
 *
 * 代价是周末方案的玩法池比完整词典小——音乐节、演唱会这类需要场次信息的
 * 属于「最近在玩」；徒步、露营这类京郊玩法不适用地铁站周边的逻辑；
 * 看夜景、胡同夜游这类氛围型需要一份人工整理的地点表。它们留在词典里，
 * 只是暂时不由周末方案提供。
 */
export function buildAnchoredPlan({ people, duration, locationScope, lines, exclude = [], attempts = 40 } = {}) {
  const emptyResult = {
    people, duration, locationScope: locationScope || "both",
    structure: { type: "empty", moduleCount: 0 },
    experiences: [], steps: [], empty: true, station: null, line: null, anchored: 0,
  };
  if (!lines || !lines.length) return emptyResult;
  const candidates = fortuneCandidates(lines);
  if (!candidates.length) return emptyResult;

  const budget = DURATION_BUDGET[duration] ?? Number.MAX_SAFE_INTEGER;
  const excluded = new Set(exclude);
  let best = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const entry = randomItem(candidates);
    const pois = findNearbyPois(coordinatesOf(entry.station));
    const pools = filterExperiences({ people, duration, locationScope, combining: true });
    const coreOk = pools.core.filter((e) => !excluded.has(e.id) && placeableAt(e, pois));
    if (!coreOk.length) continue;
    const supportOk = pools.support.filter((e) => !excluded.has(e.id) && placeableAt(e, pois));

    const used = new Set(excluded);
    const taken = new Set();
    const steps = [];
    const place = (experience) => {
      const matched = matchPlace(experience, pois, taken);
      if (matched.place) taken.add(matched.place.id);
      steps.push({ experience, placeMode: matched.mode, place: matched.place || null, hint: matched.hint || null });
    };
    const plan = [randomItem(coreOk)];
    used.add(plan[0].id);
    place(plan[0]);

    if (plan[0].combinable !== false) {
      if (plan[0].duration_type === "full_day") {
        // 整天型玩法占满白天，但晚上还能接一段轻的
        const tail = supportOk.filter((e) => !used.has(e.id) && compatibleScope(e, plan[0]) && placeableAt(e, pois, taken));
        if (tail.length) { const pick = randomItem(tail); plan.push(pick); place(pick); }
      } else {
        // 按 duration_min（赶一点的版本）排，不按 duration_max。一个展览写的是
        // 「90-180 分」，照 180 算，半天的 300 分钟预算减完就只剩 120，再也塞不下
        // 第二件事——结果每次都只给一个环节。照 90 算才排得开。
        let remaining = budget - plan[0].duration_min - TRANSIT_MINUTES;
        let coreCount = 1;
        let supportCount = 0;
        let guard = 0;
        while (plan.length < 3 && guard < 6) {
          guard += 1;
          const primary = plan[0];
          const fits = (e) => !used.has(e.id) && compatibleScope(e, primary)
            && e.duration_min <= remaining && placeableAt(e, pois, taken);
          const co = coreCount < 2 ? coreOk.filter(fits) : [];
          const so = supportCount < 1 ? supportOk.filter(fits) : [];
          const pick = co.length ? randomItem(co) : (so.length ? randomItem(so) : null);
          if (!pick) break;
          plan.push(pick);
          used.add(pick.id);
          place(pick);
          remaining -= pick.duration_min + TRANSIT_MINUTES;
          if (pick.role === "support") supportCount += 1; else coreCount += 1;
        }
      }
    }

    const anchored = steps.filter((s) => s.place).length;
    const scored = {
      people, duration, locationScope: locationScope || "both",
      structure: { type: "anchored", moduleCount: plan.length },
      experiences: plan, steps, empty: false,
      station: entry.station, line: randomItem(entry.lines), anchored,
    };
    if (!best || anchored > best.anchored || (anchored === best.anchored && steps.length > best.steps.length)) {
      best = scored;
    }
    if (anchored === steps.length && steps.length >= 2) break;
  }
  return best || emptyResult;
}
