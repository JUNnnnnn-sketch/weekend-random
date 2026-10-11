import { experiences } from "./data/experiences.js";
import { stationCoordinates } from "./data/station_coordinates.js";
import { nearbyPois } from "./data/station_pois.js";
import { placeRuleFor, AREA_SUBTYPES } from "./experience_places.js";
import { curatedPlaces, curatedRoutes } from "./data/curated_places.js";

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
function radiusFor(duration) { return { "下班后": 2, "半天": 5, "一天或以上": 12 }[duration]; }

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
// 档位用场景命名，不用钟点。「2-3小时」是个数字，「下班后」是个画面——
// 后者才说得清这一档该给什么。
const DURATION_WINDOW = {
  "下班后": [120, 180],
  "半天": [180, 300],
  "一天或以上": [300, 1440],   // 上界放到 24 小时，容得下过夜
};

// 每个时长档位的总时间预算（分钟上限），用于可行性校验（support 不能让总时间明显超预算）。
// 环节之间留的路上时间。
const TRANSIT_MINUTES = 30;

const DURATION_BUDGET = {
  "下班后": 180,
  "半天": 300,
  // 不按 24 小时给预算：过夜的那一件事（露营）本身就占满了，
  // 剩下的时间是睡觉，不该再排进两个环节。按一个白天算。
  "一天或以上": 600,
};

// 每个时长档位允许出现的 duration_type。multi_day 在任何 MVP 档位都不参与（需住宿的京郊目的地直接排除）。
const ALLOW_TYPE = {
  "下班后": ["short"],
  "半天": ["short", "half_day"],
  // multi_day 原先任何档位都不放行，于是「野营过夜」在词典里躺着却永远抽不到。
  // 档位改成「一天或以上」之后它有了归宿——露营的时长本来就写的是 6-24 小时，
  // 24 小时就是过夜。
  "一天或以上": ["short", "half_day", "full_day", "multi_day"],
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
 *   - suburban（京郊）Experience 只在「一天或以上」进入候选；下班后 / 半天完全不出现京郊。
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
 * 不开这个开关时，「一天或以上」只会留下 duration_max >= 300 的玩法——实测每站
 * 只剩植物园和动物园两条，排不出行程。
 */
export function filterExperiences({ people, duration, locationScope, combining = false, now = new Date() } = {}) {
  const code = peopleCodeOf(people);
  const season = currentSeason(now);
  const win = DURATION_WINDOW[duration] || [0, Number.MAX_SAFE_INTEGER];
  const allowType = ALLOW_TYPE[duration] || ["short"];
  const suburbanAllowed = duration === "一天或以上";
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
      if (exp.location_scope === "suburban" && !suburbanAllowed) continue; // 京郊仅「一天或以上」
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
 *   2. multi_day 任何档位都不参与；京郊(suburban)只在「一天或以上」出现，且作为完整出行场景。
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

  // 下班后：一个 short core 即成立，不强行加 support。
  if (duration === "下班后") return finalize(plan, ctx, "single_core");
  // 不可组合的 core：单独成方案。
  if (plan[0].combinable === false) {
    return finalize(plan, ctx, "non_combinable_core");
  }
  // full_day 的 core 占满了白天，但晚上还能接一段轻的——爬了一天山，晚上吃个饭
  // 喝一杯是成立的。原先直接单条返回，是「一天或以上反而最空」的主因之一。
  if (plan[0].duration_type === "full_day") {
    const tail = supportPool.filter((e) => !used.has(e.id) && compatibleScope(e, plan[0]));
    if (tail.length) plan.push(randomItem(tail));
    return finalize(plan, ctx, plan.length > 1 ? "full_day_core_support" : "full_day_core");
  }

  // 半天 / 一天或以上：在剩余预算内尝试补充（不强制），至多 2 个 core + 1 个 support。
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
  const curated = pois.filter((p) => p.curated_for === experience.name && !taken.has(p.id));
  if (curated.length) {
    const pick = weightedPick(curated);
    return { mode: "curated", place: pick, hint: pick.note || null };
  }
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
 * 人气加权抽取。
 *
 * 手工整理的那批数据带「百分之多少的人推荐」——划船里亮马河 38%、通州大运河 2%。
 * 这是 OSM 给不了的信号，均匀随机会把它浪费掉：一个 2% 的地方和一个 38% 的
 * 地方同样容易被抽到，用户体感就是推荐质量忽高忽低。
 *
 * 但也不能只给最高的那个，否则每次都是亮马河，这个产品就没意思了。
 * 加权随机是中间路线：人气高的更常出现，冷门的仍然有机会。
 * 没标人气的按 8 算（比最低的 1% 高，比热门的低），不至于永远抽不到。
 */
const DEFAULT_WEIGHT = 8;

export function weightedPick(items, weightOf = (x) => x.popularity || DEFAULT_WEIGHT) {
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + Math.max(1, weightOf(item)), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(1, weightOf(item));
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/** 出城的门槛：离最近地铁站 20 公里以上，地铁去不了，得开车。 */
export const OUTSKIRTS_MIN_KM = 20;

/**
 * 「一天或以上」里有多大比例给出城方案。
 *
 * 不是越多越好：出城要开车，不是每个人每个周末都愿意。但也不能太少，
 * 否则那 24 条出城数据基本等于不存在。三分之一是个让它稳定出现、
 * 又不喧宾夺主的比例。
 */
const OUTSKIRTS_SHARE = 1 / 3;

let outskirtsCache = null;
/** 出城目的地：按地点聚合，一个地方带着它能干的所有事。 */
export function outskirtsDestinations() {
  if (outskirtsCache) return outskirtsCache;
  const byName = new Map();
  for (const place of curatedPlaces) {
    if (place.latitude === undefined || place.nearest_km < OUTSKIRTS_MIN_KM) continue;
    const entry = byName.get(place.name) || {
      name: place.name, latitude: place.latitude, longitude: place.longitude,
      nearest_station: place.nearest_station, nearest_km: place.nearest_km,
      source_url: place.source_url, options: [],
    };
    entry.options.push(place);
    byName.set(place.name, entry);
  }
  outskirtsCache = [...byName.values()];
  return outskirtsCache;
}

/**
 * 出城方案：锚是目的地本身，不是地铁站。
 *
 * 城区方案的逻辑是「先定地铁站，再看站周边 1.2 公里内有什么」——那成立是因为
 * 城区地铁站周边东西够密。出城数据的形状相反：地点孤立，但很深。金海湖一个地方
 * 能钓鱼、野餐、玩帆板、看日落；妙峰山能看日出、看日落、观星。
 *
 * 所以逻辑一样、粒度不同：先定一个地方，再看那儿能干什么。
 * 不是跑三个地方，是去一个地方待一天。
 */
export function buildOutskirtsPlan({ people, duration, exclude = [], now = new Date() } = {}) {
  const season = currentSeason(now);
  const code = peopleCodeOf(people);
  const byId = new Map(experiences.map((e) => [e.name, e]));
  const excluded = new Set(exclude);

  const usable = outskirtsDestinations().map((dest) => {
    const options = dest.options.filter((place) => {
      const exp = byId.get(place.experience);
      if (!exp || excluded.has(exp.id)) return false;
      if (!exp.suitable_people.includes(code)) return false;
      if (!inSeason(exp, season)) return false;              // 七月的滑雪场没有意义
      return place.season === "all_year" || place.season === season;
    });
    return { ...dest, options };
  }).filter((dest) => dest.options.length);
  if (!usable.length) return null;

  // 先按「这地方最热门的那件事有多热门」挑目的地，再在它支持的事里挑
  const destination = weightedPick(usable, (d) =>
    Math.max(...d.options.map((o) => o.popularity || DEFAULT_WEIGHT)));

  const picked = [];
  const pool = [...destination.options];
  while (picked.length < 3 && pool.length) {
    const choice = weightedPick(pool);
    picked.push(choice);
    pool.splice(pool.indexOf(choice), 1);
    // 同一个地方的玩法彼此不重复，但也不必凑满三个——金海湖只有四件事可干
    if (picked.length >= 2 && Math.random() < 0.5) break;
  }

  return {
    people, duration, kind: "outskirts", empty: false,
    destination,
    steps: picked.map((place) => ({
      experience: byId.get(place.experience),
      place: { ...place, name: destination.name },
      placeMode: "outskirts",
      hint: place.note || null,
    })),
    experiences: picked.map((place) => byId.get(place.experience)),
    anchored: picked.length,
    structure: { type: "outskirts", moduleCount: picked.length },
  };
}

/**
 * 把手工整理的地点并进某一站的「附近有什么」。
 *
 * station_pois.js 是按地理标签扫出来的，覆盖不到「适合划船的地方」「看夜景的
 * 机位」这类判断——OSM 没有这种字段。实测这 23 个玩法（划船、看夜景、野餐、
 * 钓鱼、看日落、滑冰……）一个都没有 OSM 规则，全靠这批手工数据。
 *
 * 只并入有坐标的。没坐标的那 111 条（壁球馆、汤泉馆、采摘园这些 OSM 不收的
 * 商业场所）进不了按站点锚定的方案——不知道它在哪，就不能说它在这一站附近。
 * 它们留在数据里，等一个不依赖坐标的出口。
 *
 * 出城的（离最近站 20 公里以上）也不并入：那是 buildOutskirtsPlan 的事。
 */
function curatedNear(station, { radiusKm = NEARBY_RADIUS_KM, now = new Date() } = {}) {
  const coords = coordinatesOf(station);
  if (coords.latitude === null) return [];
  const season = currentSeason(now);
  const out = [];
  for (const place of curatedPlaces) {
    if (place.latitude === undefined || place.nearest_km >= OUTSKIRTS_MIN_KM) continue;
    if (place.season !== "all_year" && place.season !== season) continue;   // 户外冰场只在冬天
    const km = distanceKm(coords, place);
    if (km > radiusKm) continue;
    out.push({ ...place, distance_km: km, curated_for: place.experience });
  }
  return out.sort((a, b) => a.distance_km - b.distance_km);
}

/** 某一站附近的全部可用地点：OSM 扫出来的 + 手工整理的。 */
export function placesAround(station, { radiusKm = NEARBY_RADIUS_KM, now = new Date() } = {}) {
  return [...findNearbyPois(coordinatesOf(station), { radiusKm }),
          ...curatedNear(station, { radiusKm, now })];
}

/**
 * 路线方案。
 *
 * 路线是数据里的第三种东西：点是「在哪」（军事博物馆），面是「在这一带」
 * （798、南锣鼓巷），线是「怎么走」（前门—杨梅竹斜街线）。
 *
 * 线的特点是它占满时间，所以它本身就是整个方案，不是方案里的一个环节。
 * 「经典胡同漫游线」写得清楚：3.5 公里，慢慢逛 4-5 小时——
 * 你不可能走完它再去打两小时壁球。
 *
 * 而且路线天然是站点锚定的：18 条里 16 条的起点就是地铁站，不用查坐标。
 */
const DURATION_RANK = { "下班后": 1, "半天": 2, "一天或以上": 3 };

/** 路线在「周末方案」里出现的比例。比出城低——路线只有 18 条，刷太勤会腻。 */
const ROUTE_SHARE = 1 / 5;

/** 从某一站出发、且时间放得下的路线。 */
export function routesFrom(stationName, { duration, now = new Date() } = {}) {
  const season = currentSeason(now);
  const budget = DURATION_RANK[duration] ?? 3;
  return curatedRoutes.filter((route) =>
    route.start_station === stationName
    && (route.season === "all_year" || route.season === season)
    && (DURATION_RANK[route.duration] ?? 3) <= budget);
}

export function buildRoutePlan({ people, duration, lines, exclude = [], now = new Date() } = {}) {
  const candidates = fortuneCandidates(lines);
  if (!candidates.length) return null;
  const byName = new Map(experiences.map((e) => [e.name, e]));
  const code = peopleCodeOf(people);
  const excluded = new Set(exclude);

  // 哪些候选站有路线可走
  const withRoutes = [];
  for (const entry of candidates) {
    const routes = routesFrom(entry.station.station_name, { duration, now }).filter((route) => {
      const exp = byName.get(route.experience);
      return exp && !excluded.has(exp.id) && exp.suitable_people.includes(code);
    });
    if (routes.length) withRoutes.push({ entry, routes });
  }
  if (!withRoutes.length) return null;

  const spot = randomItem(withRoutes);
  const route = randomItem(spot.routes);
  const experience = byName.get(route.experience);
  const steps = [{ experience, route, placeMode: "route", place: null, hint: route.highlight || null }];

  // 路线比这次的时长短时，后面还塞得下一件轻的——比如走完胡同去喝杯下午茶
  if ((DURATION_RANK[route.duration] ?? 3) < (DURATION_RANK[duration] ?? 3)) {
    const pois = placesAround(spot.entry.station, { now });
    const { support } = filterExperiences({ people, duration, combining: true, now });
    const tail = support.filter((e) => !excluded.has(e.id) && placeableAt(e, pois));
    if (tail.length) {
      const pick = randomItem(tail);
      const matched = matchPlace(pick, pois, new Set());
      steps.push({ experience: pick, placeMode: matched.mode, place: matched.place || null,
                   hint: matched.hint || null });
    }
  }

  return {
    people, duration, kind: "route", empty: false,
    station: spot.entry.station, line: randomItem(spot.entry.lines),
    route, steps, experiences: steps.map((s) => s.experience),
    anchored: steps.length,
    structure: { type: "route", moduleCount: steps.length },
  };
}

/**
 * 这条玩法在这批 POI 里能不能落地。
 * taken 是本次行程已经用掉的地点——同一个剧场不能既算「音乐厅」又算「京剧」，
 * 否则第二环会挂空。
 */
function placeableAt(experience, pois, taken = new Set()) {
  const free = pois.filter((p) => !taken.has(p.id));
  // 手工整理的地点带人气和一句话，比 OSM 的标签匹配靠谱，优先
  if (free.some((p) => p.curated_for === experience.name)) return true;
  const rule = placeRuleFor(experience.name);
  if (!rule) return false;                         // 既没手工地点也没 OSM 规则的，不提供
  if (rule.mode === "area") return free.some((p) => AREA_SUBTYPES.includes(p.subtype));
  return free.some((p) => rule.subtypes.includes(p.subtype));
}

/** 某一站附近能落地的玩法，供界面「换一个」时限定范围。 */
export function placeableExperiencesAt(station, { people, duration, locationScope, role = "core", taken = [], now = new Date() } = {}) {
  const pois = placesAround(station, { now });
  const used = new Set(taken);
  const pools = filterExperiences({ people, duration, locationScope, combining: true });
  const pool = role === "support" ? pools.support : pools.core;
  return pool.filter((e) => placeableAt(e, pois, used));
}

/** 换玩法之后重新给这一环挂地点。 */
export function matchPlaceFor(experience, station, taken = new Set(), { now = new Date() } = {}) {
  const pois = placesAround(station, { now });
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
export function buildAnchoredPlan({ people, duration, locationScope, lines, exclude = [], attempts = 40, now = new Date() } = {}) {
  // 一天或以上才可能出城——2-3 小时和半天开车去金海湖不现实。
  // 出城方案失败（比如七月份只剩滑雪场）就照常走城区逻辑，不留空。
  if (duration === "一天或以上" && Math.random() < OUTSKIRTS_SHARE) {
    const trip = buildOutskirtsPlan({ people, duration, exclude, now });
    if (trip) return trip;
  }
  // 路线放在出城之后：出城是「一天或以上」专属，路线哪个时长都可能有
  if (Math.random() < ROUTE_SHARE) {
    const walk = buildRoutePlan({ people, duration, lines, exclude, now });
    if (walk) return walk;
  }
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
    const pois = placesAround(entry.station, { now });
    const pools = filterExperiences({ people, duration, locationScope, combining: true, now });
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
