import { subwayLines } from "./data/subway.js";
import { activities, activityDataAsOf } from "./data/activities.js";
import { activitiesChncpa } from "./data/activities_chncpa.js";
import { pickDestination, findNearbyPois, NEARBY_RADIUS_KM, freshness, buildAnchoredPlan, fortuneCandidates, placeableExperiencesAt, matchPlaceFor, pickWorthATrip } from "./recommendation.js";
import { poiSource } from "./data/station_pois.js";
import { experiences as allExperiences } from "./data/experiences.js";
import { saveTicket } from "./ticket-image.js";

/* ---------- 「最近在玩」共享过滤（与 tools/activity_filter.py 同一套规则） ---------- */
const CATEGORY_BLACKLIST = new Set(["便民活动", "招考招聘", "惠企活动"]);
const TITLE_KEYWORD_BLACKLIST = new Set(["党史", "反诈", "普法", "宣讲", "进社区", "义诊", "招聘", "政策解读", "安全生产", "消防", "主题教育", "表彰"]);
function applyActivityFilters(list) {
  return list.filter((a) => {
    if (CATEGORY_BLACKLIST.has(a.category)) return false;
    const n = a.name || "";
    for (const k of TITLE_KEYWORD_BLACKLIST) if (n.includes(k)) return false;
    return true;
  });
}
// 合并现有来源（城市日历）与新来源（国家大剧院），统一过两层过滤
const allActivities = applyActivityFilters([...activities, ...activitiesChncpa]);

/* 排序信号（三信号简单分档，非加权；与 activity_filter.py 一致） */
const VENUE_WHITELIST = new Set(["国家大剧院", "中国国家博物馆", "国家博物馆", "故宫博物院", "首都博物馆", "中国美术馆", "北京天文馆", "中国科学技术馆", "国家自然博物馆", "中国地质博物馆", "中国园林博物馆", "清华大学艺术博物馆", "北京汽车博物馆", "中国人民革命军事博物馆", "中国人民抗日战争纪念馆", "国家典籍博物馆", "中国现代文学馆", "中国电影博物馆", "中国妇女儿童博物馆", "中国铁道博物馆", "中国铁道博物馆正阳门展馆", "北京天文馆-北京古观象台", "北京民俗博物馆", "北京城市图书馆", "北京中华民族博物院", "首都图书馆", "梅兰芳大剧院", "中央歌剧院剧场", "国家话剧院剧场", "北京音乐厅", "北京天桥艺术中心", "国家大剧院-歌剧院", "国家大剧院-音乐厅", "国家大剧院-戏剧场"]);
const CENTRAL_DISTRICTS = new Set(["东城区", "西城区", "朝阳区", "海淀区"]);
const MID_DISTRICTS = new Set(["丰台区", "石景山区", "通州区", "昌平区", "门头沟区", "北京市", "线上"]);
const GRASS_RE = /街道|社区|村|乡/;
function venueTier(v) { return VENUE_WHITELIST.has(v) ? 0 : 1; }
function districtTier(d) { return CENTRAL_DISTRICTS.has(d) ? 0 : (MID_DISTRICTS.has(d) ? 1 : 2); }
function organizerTier(a) { return GRASS_RE.test([a.venue, a.address, a.name].filter(Boolean).join(" ")) ? 1 : 0; }

const STORAGE_KEY = "weekend-dont-think-v02";
const state = { mode: "fortune", party: "", duration: "", destination: null, result: null };
let currentScreen = "home";
let navigationStack = [];
let rollRunId = 0;
const screens = Object.fromEntries([...document.querySelectorAll(".screen")].map((screen) => [screen.dataset.screen, screen]));
const continueBtn = document.getElementById("btn-continue");
const rollStatus = document.getElementById("roll-status");
const reel = document.getElementById("reel");
const reelValue = document.getElementById("reel-value");
const rollLog = document.getElementById("roll-log");

function saveSession() { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ state, currentScreen, navigationStack })); }
function showScreen(name, { remember = true } = {}) {
  if (remember && currentScreen !== name) navigationStack.push(currentScreen);
  currentScreen = name;
  if (name === "setup") document.getElementById("setup-title").textContent = setupTitleFor(state.mode);
  if (name === "roll") {
    document.getElementById("roll-kicker").textContent =
      state.mode === "plan" ? "正在给你凑一套" : "命运正在抽签";
  }
  Object.entries(screens).forEach(([key, screen]) => { const active = key === name; screen.classList.toggle("is-active", active); screen.toggleAttribute("hidden", !active); screen.setAttribute("aria-hidden", String(!active)); });
  saveSession();
}
function goBack() { rollRunId += 1; showScreen(navigationStack.pop() || "home", { remember: false }); }
function goHome() { rollRunId += 1; navigationStack = []; showScreen("home", { remember: false }); }
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function addLog(text, done = false) { const item = document.createElement("li"); item.textContent = text; item.classList.toggle("is-done", done); rollLog.append(item); }
/**
 * 命运模式不问任何问题——它的全部意思就是「不用想，让命运决定」，
 * 还要先填两道题是自相矛盾的。人数对「附近有什么」没有真实影响；时长也没有：
 * 有半天还是有一天或以上，并不改变你愿不愿意多走十分钟。两个都去掉。
 * 周末方案继续问人数和时长，那里 buildWeekendPlan 真的在用。
 */
function needsSetup(mode) { return mode !== "fortune"; }
function updateContinue() { continueBtn.disabled = !(state.party && state.duration); }
function restoreSelectionUI() { document.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("is-selected", state[chip.dataset.group] === chip.dataset.value)); updateContinue(); }

function setupTitleFor(mode) { return mode === "fortune" ? "先告诉命运一点情报" : mode === "plan" ? "先告诉它会怎么过" : "先告诉这次怎么探索"; }
function setupMode(mode) { state.mode = mode; document.getElementById("setup-title").textContent = setupTitleFor(mode); updateContinue(); showScreen("setup"); }
document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
  const mode = button.dataset.mode;
  if (mode === "recent") { state.mode = "recent"; showScreen("recent"); renderRecent(); return; }
  if (!needsSetup(mode)) { state.mode = mode; startRoll(); return; }   // 命运模式直接开抽
  setupMode(mode);
}));
document.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => { state[chip.dataset.group] = chip.dataset.value; restoreSelectionUI(); saveSession(); }));
document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", goBack));
document.querySelectorAll("[data-home]").forEach((button) => button.addEventListener("click", goHome));
document.getElementById("btn-continue").addEventListener("click", () => { if (state.mode === "plan") { startPlan(); return; } startRoll(); });
document.getElementById("btn-retry").addEventListener("click", startRoll);
/**
 * 锁定不该把前面看到的东西清空——锁完还得照着去玩，甚至截图发给朋友。
 * 这里把结果页的内容整块搬进锁定页，只改标题和状态。
 */
function lockWith(subtitle, sourceNode) {
  document.getElementById("locked-subtitle").textContent = subtitle;
  // 票根上印个日期，截图发出去才看得出是哪天的事
  const now = new Date();
  const weekday = "日一二三四五六"[now.getDay()];
  document.getElementById("locked-date").textContent =
    `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · 星期${weekday}`
    + (state.party && state.duration ? ` · ${state.party} · ${state.duration}` : "");
  const detail = document.getElementById("locked-detail");
  detail.replaceChildren();
  if (sourceNode) [...sourceNode.children].forEach((node) => detail.append(node.cloneNode(true)));
  detail.querySelectorAll("button").forEach((btn) => btn.remove());  // 锁定页不留可操作按钮
  document.getElementById("ticket-shot").replaceChildren();          // 上一次存的图不留到这一次
  showScreen("locked");
}
document.getElementById("btn-accept").addEventListener("click", () => {
  lockWith(`${state.destination.label || state.destination.name}。出门就好。`,
           document.getElementById("place-list"));
});
document.getElementById("btn-home").addEventListener("click", goHome);
document.getElementById("btn-ticket-save").addEventListener("click", (event) => {
  const btn = event.currentTarget;
  btn.disabled = true;
  btn.textContent = "正在画……";
  try {
    saveTicket(document.getElementById("ticket-shot"));
    btn.textContent = "✓ 已存图片";
  } catch (error) {
    btn.textContent = "存图失败，截个屏吧";
    console.error(error);
  }
  setTimeout(() => { btn.disabled = false; btn.textContent = "💾 存成图片"; }, 2600);
});

/* ---------- 最近在玩（recent）模式：只读已接入的城市日历活动，不做热度/推荐 ---------- */
// 筛选标签 → 来源官方类别（其余类别无独立标签，只出现在“全部”下）
const CAT_TABS = { 全部: null, 展览: "博物馆展览", 演出: "文化演出", 体育: "体育赛事", 游园: "游园活动", 展会: "展会活动" };
// 明显非休闲的政务/民生噪声：展示层直接过滤，不参与“最近有什么可以去”
const NON_LEISURE = new Set(["招考招聘", "惠企活动"]);
let recentCat = "全部";
let recentDistrict = "全部";
let currentPick = null;

function parseActivityDate(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) { const Y = +m[1], M = +m[2], D = +m[3]; if (M >= 1 && M <= 12 && D >= 1 && D <= 31) return new Date(Y, M - 1, D); }
  return null;
}
// 「现在」以浏览器真实当前日期为锚（即打开页面当天），不再用 activityDataAsOf 当时间窗口基准；
// activityDataAsOf 仅作为「数据更新于」展示（见 renderRecent），不参与窗口判断。
function activityRefDate() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function activityStatusRank(a, ref, plus7) {
  const sd = parseActivityDate(a.start_date), ed = parseActivityDate(a.end_date);
  if (!sd && !ed) return 2;          // 日期待定
  if (sd && sd > ref) return 0;      // 即将开始
  if (ed && ed >= ref) return 1;     // 正在进行
  return 1;
}
function isShowable(a, ref, plus7) {
  if (NON_LEISURE.has(a.category)) return false;     // 过滤招考招聘/惠企等噪声
  const sd = parseActivityDate(a.start_date), ed = parseActivityDate(a.end_date);
  if (ed && ed < ref) return false;                  // 已结束
  if (sd && sd > plus7) return false;                // 超过未来 7 天
  return true;                                       // 其余展示（含日期不明确的，由卡片标注）
}
// 单条活动的「信号分档」：状态(即将开始0/进行中1/日期待定2) → 主办方层级(街道/社区/村/乡沉底) → 场馆白名单 → 中心城区
// 先按分档排序，档内随机打散（不再用日期做固定尾序，避免每次进入顺序雷同）。
function signalTier(a, ref, plus7) {
  return JSON.stringify([activityStatusRank(a, ref, plus7), organizerTier(a), venueTier(a.venue), districtTier(a.district)]);
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function filterSortActivities() {
  const ref = activityRefDate();
  const plus7 = new Date(ref); plus7.setDate(ref.getDate() + 7);
  let list = allActivities.filter((a) => isShowable(a, ref, plus7));
  const want = CAT_TABS[recentCat];
  if (want) list = list.filter((a) => a.category === want);
  if (recentDistrict && recentDistrict !== "全部") list = list.filter((a) => a.district === recentDistrict);
  // 先按信号分档，档内随机打散
  const buckets = new Map();
  for (const a of list) {
    const t = signalTier(a, ref, plus7);
    if (!buckets.has(t)) buckets.set(t, []);
    buckets.get(t).push(a);
  }
  return [...buckets.keys()].sort().flatMap((t) => shuffle(buckets.get(t)));
}
function esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function dateLabel(a) { const s = a.start_date, e = a.end_date; if (s && e && s !== e) return `${s} ~ ${e}`; return s || e || "日期待定"; }
function dateUnclear(a) { return (a.start_date && !parseActivityDate(a.start_date)) || (a.end_date && !parseActivityDate(a.end_date)); }
function renderActivityCard(a) {
  const card = document.createElement("article"); card.className = "place-card activity-card";
  const warn = dateUnclear(a) ? '<span class="place-freshness warn">⚠ 日期信息不完整</span>' : "";
  card.innerHTML = `
    <div><p class="place-category">${esc(a.category)}</p><h3>${esc(a.name)}</h3></div>
    <p class="activity-meta">${esc(a.district)} · ${esc(a.venue)}</p>
    <p class="activity-date">📅 ${dateLabel(a)} ${warn}</p>
    <p class="activity-desc">${esc(a.description)}</p>
    <p class="place-freshness">数据更新 ${esc(a.collected_at)} · 来源 ${esc(a.source)}</p>
    <a class="activity-detail" href="${esc(a.source_url)}" target="_blank" rel="noreferrer">查看活动详情 ↗</a>`;
  return card;
}
function renderRecent() {
  const asofEl = document.getElementById("recent-asof"); if (asofEl) asofEl.textContent = activityDataAsOf;
  const list = filterSortActivities();
  const container = document.getElementById("activity-list");
  container.replaceChildren();
  document.getElementById("recent-empty").hidden = list.length > 0;
  list.forEach((a) => container.append(renderActivityCard(a)));
}
function pickRandomActivity() {
  const ref = activityRefDate();
  const plus7 = new Date(ref); plus7.setDate(ref.getDate() + 7);
  const pool = allActivities.filter((a) => isShowable(a, ref, plus7) && a.source_url);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
function renderPick() {
  const list = document.getElementById("pick-list");
  const a = pickRandomActivity();
  currentPick = a;
  if (!a) { list.innerHTML = '<p class="empty">当前没有可推荐的有效活动。系统不会编造。</p>'; return; }
  list.replaceChildren(renderActivityCard(a));
}
function populateDistricts() {
  const sel = document.getElementById("recent-district");
  const districts = [...new Set(allActivities.map((a) => a.district).filter(Boolean))].sort();
  sel.replaceChildren();
  const all = document.createElement("option"); all.value = "全部"; all.textContent = "全部"; sel.append(all);
  districts.forEach((d) => { const o = document.createElement("option"); o.value = d; o.textContent = d; sel.append(o); });
  recentDistrict = "全部";
}

async function spinTo(pool, finalValue, status, runId) {
  rollStatus.textContent = status; reel.classList.add("is-spinning");
  for (let index = 0; index < 12; index += 1) { if (runId !== rollRunId) return false; reelValue.textContent = pool[index % pool.length]; await wait(75 + index * 7); }
  reel.classList.remove("is-spinning"); reelValue.textContent = finalValue; return true;
}

async function startRoll() {
  const runId = ++rollRunId; rollLog.replaceChildren();
  document.getElementById("roll-kicker").textContent = "命运正在抽签";
  showScreen("roll");
  // 命运模式只做一件事：在覆盖范围内随机线路 -> 随机站点。“附近有什么”是下一阶段。
  const radiusKm = NEARBY_RADIUS_KM;
  const picked = pickDestination(subwayLines, { radiusKm });
  if (!picked) { addLog("暂时没有可用的地铁线路数据", true); return; }
  const { line, station, destination, lineNames, stationNames } = picked;
  state.destination = destination;
  addLog("正在决定地铁线……"); if (!await spinTo(lineNames, line.line_name, "正在决定地铁线……", runId)) return;
  addLog(line.line_name, true); await wait(350); addLog("正在决定车站……");
  if (!await spinTo(stationNames, station.station_name, "正在决定车站……", runId)) return;
  addLog(station.station_name, true);
  if (runId !== rollRunId) return;
  state.result = null; // 抽签阶段到此结束；“附近有什么”是独立的下一阶段。
  await wait(350); renderResult(); showScreen("result");
}

function renderResult() {
  document.querySelector("#screen-result .actions").hidden = false;
  document.getElementById("result-kicker").textContent = "命运已揭晓";
  document.querySelector(".result-title").innerHTML = "🎯 今天的目的地<br /><span id=\"result-station\"></span>";
  document.getElementById("result-station").textContent = state.destination.label || state.destination.name;
  renderDestinationOnly();
}

/** 命运模式的结果页：只公布目的地（线路 + 站点），并为下一阶段留出入口。缺坐标不影响展示。 */
function renderDestinationOnly() {
  const { line_name, station_order } = state.destination;
  const radiusKm = NEARBY_RADIUS_KM;
  document.getElementById("result-meta").textContent = `${line_name} 第 ${station_order} 站 · 步行 ${radiusKm} km 内`;
  document.getElementById("explore-task").hidden = true;

  const pois = findNearbyPois(state.destination, { radiusKm });
  const list = document.getElementById("place-list"); list.replaceChildren();

  if (!pois.length) {
    document.querySelector(".result-lead").textContent = "🚇 这一站";
    list.innerHTML = '<p class="empty">这站附近还没有收录到值得推荐的地方。系统不会为了凑数扩大范围——出门随便走走也不错。</p>';
    return;
  }

  document.querySelector(".result-lead").textContent = `📍 ${state.destination.station_name}附近`;
  // 展示顺序：专程去的在前，吃喝是顺带的，放最后
  const CATEGORY_ORDER = ["🧭 特色去处", "🎨 艺术 / 展览", "🎵 音乐 / 演出", "🏛 寺庙 / 古迹",
                         "🌳 公园 / 自然", "🛍 商场 / 商圈", "📚 书店 / 图书馆",
                         "🏟 场馆 / 运动", "🎯 玩乐场地", "🍸 夜生活", "🍜 吃喝"];
  // 按品类分组展示；组内按距离升序。同一个站每次结果一致，随机性只发生在抽站那一步。
  const groups = new Map();
  pois.forEach((poi) => {
    if (!groups.has(poi.category)) groups.set(poi.category, []);
    groups.get(poi.category).push(poi);
  });
  const ordered = [...groups.entries()].sort((a, b) => {
    const rank = (c) => { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? CATEGORY_ORDER.length : i; };
    return rank(a[0]) - rank(b[0]);
  });
  ordered.forEach(([category, items]) => {
    const card = document.createElement("article"); card.className = "place-card";
    const SHOWN = 8;   // 显示 5 条却提示「另有 1 个未列出」很奇怪，放宽到 8 条
    const rows = items.slice(0, SHOWN).map((poi) =>
      `<p><strong>${esc(poi.name)}</strong> · ${esc(poi.subtype)}<br /><span class="place-freshness">步行约 ${Math.round(poi.distance_km * 1000)} 米 · ${placeLinks(poi, poi.name)}</span></p>`).join("");
    const more = items.length > SHOWN ? `<p class="place-freshness">另有 ${items.length - SHOWN} 个</p>` : "";
    card.innerHTML = `<div><p class="place-category">${category}</p><h3>${items.length} 个</h3></div>${rows}${more}`;
    list.append(card);
  });

  list.append(renderWorthATrip());

  const note = document.createElement("p");
  note.className = "place-freshness";
  note.innerHTML = `范围 ${radiusKm} km 内 · 场所数据来自 <a href="${poiSource.url}" target="_blank" rel="noreferrer">${poiSource.name}</a>（${poiSource.license}）· 只收录场所，不含演出排期`;
  list.append(note);
}

// 已经摇出来过的，换一个时不重复
let tripSeen = [];

/**
 * 「或者，专程去一趟」。
 *
 * 收录的地方里有一批命运模式永远给不出来：周边凑不够 3 个可推荐的地方，
 * 或者离最近的站太远。它们不是不好，是不在「出地铁走一刻钟」这个模式里。
 * 与其让三分之一的数据看不见，不如在站点清单末尾单开一块，
 * 老实写明从哪站出来还有多远。
 */
function renderWorthATrip(place) {
  const pick = place || pickWorthATrip(subwayLines, { exclude: tripSeen });
  const card = document.createElement("article");
  card.className = "place-card trip-card";
  if (!pick) {
    card.innerHTML = '<div><p class="place-category">🧳 或者，专程去一趟</p></div>'
      + '<p class="empty">这一类暂时没有收录到地方。</p>';
    return card;
  }
  if (!tripSeen.includes(pick.id)) tripSeen.push(pick.id);
  const km = pick.nearest.distance_km;
  card.innerHTML = `
    <div><p class="place-category">🧳 或者，专程去一趟</p><h3>${esc(pick.name)}</h3></div>
    <p class="activity-meta">${esc(pick.category)} · ${esc(pick.subtype)}</p>
    <p class="place-freshness">地铁到不了——最近的是 ${esc(pick.nearest.station_name)}站，出来还有 ${km.toFixed(1)} 公里，
      得换公交或打车 · ${placeLinks(pick, pick.name)}</p>
    <button class="btn btn-ghost btn-trip" type="button">换一个</button>`;
  card.querySelector(".btn-trip").addEventListener("click", () => {
    card.replaceWith(renderWorthATrip());
  });
  return card;
}
/** 出城方案换玩法：只能换成这同一个目的地还能干的别的事。 */
function swapTripModule(i) {
  const shown = new Set(planExperiences.map((e) => e.name));
  const options = planTrip.options.filter((o) => !shown.has(o.experience)
    && !planModuleHistory[i].includes(o.experience));
  if (!options.length) return;
  const next = options[Math.floor(Math.random() * options.length)];
  const exp = allExperiences.find((e) => e.name === next.experience);
  if (!exp) return;
  planModuleHistory[i].push(planExperiences[i].name);
  planExperiences[i] = exp;
  planSwapCounts[i] += 1;
  planSteps[i] = { experience: exp, place: { ...next, name: planTrip.name },
                   placeMode: "outskirts", hint: next.note || null };
  renderPlan();
}

function renderPlace(item) {
  const card = document.createElement("article"); card.className = "place-card";
  card.innerHTML = `<div><p class="place-category">${item.category}</p><h3>${item.name}</h3></div><p>${item.category} · ${state.party}</p><p>距离 ${item.distance_km.toFixed(1)} km · 约 ${state.duration}</p><p class="place-freshness">数据${freshness(item.updated_at)}</p><a href="${item.source_url}" target="_blank" rel="noreferrer">查看数据来源 ↗</a>`;
  return card;
}
/* ---------- 周末方案（plan）模式：基于 experiences taxonomy 推荐，纯前端，不接外部数据 ---------- */
// 当前展示的方案、各模块换次数、各模块历史（避免连续重复同一 Experience）
let planExperiences = [];
let planSwapCounts = [];
let planModuleHistory = [];
let planSteps = [];      // 与 planExperiences 一一对应：时刻、地点
let planStation = null;  // 这次方案锚定的那一站（出城方案没有）
let planTrip = null;     // 出城方案锚定的那个目的地
let planRoute = null;    // 路线方案走的那条线

/**
 * 地图链接：搜名字，不传坐标。
 *
 * 原先链到 OpenStreetMap 的要素页——手机上点不开，开了也是一张英文底图，
 * 不是用户要的「这地方在哪、怎么去」。
 *
 * 为什么用关键词搜而不是传经纬度：我们的坐标是 WGS84（OSM 的标准），
 * 高德用的是 GCJ-02，直接传过去会偏五百米左右。做一次坐标纠偏当然可以，
 * 但搜名字反而更准——高德自己的 POI 库比我们全，而且搜出来是带电话、
 * 营业时间、评论的正经页面。
 *
 * callnative=1 让手机上优先唤起高德 App，没装就退回网页版。
 * OSM 的署名仍然留在页脚，那是 ODbL 的义务，和跳哪儿看地图是两回事。
 */
function mapSearchUrl(keyword) {
  const q = encodeURIComponent(String(keyword || "").trim());
  return `https://uri.amap.com/search?keyword=${q}&city=北京&callnative=1`;
}

/**
 * 找店用大众点评，不用高德。
 *
 * 「这一带哪儿能上陶艺课」这种问题，地图答不了——它只知道哪儿有个商场。
 * 点评是按「能干什么」组织的，搜「中关村 陶艺」直接出店、出价、出评价。
 * 地图负责「在哪、怎么去」，点评负责「有没有、值不值」，各管各的。
 */
function dianpingSearchUrl(keyword) {
  // 2 是大众点评的北京城市号
  return `https://www.dianping.com/search/keyword/2/0_${encodeURIComponent(String(keyword || "").trim())}`;
}

/**
 * 演出场馆搜大麦，不搜点评。
 *
 * 剧场和 Live House 这类地方，用户站在门口想知道的是「今晚演什么、还有票吗」。
 * 点评答的是「环境怎么样、停车方不方便」——答非所问。
 *
 * 为什么用 m. 开头的移动版：桌面版 search.damai.cn 按场馆名搜出来是 0 条
 * （它那个关键词只匹配演出名），移动版这个接口才会把「在这个场馆的演出」列出来。
 * 实测搜「梅兰芳大剧院」，出来的是接下来几场京剧的日期和票价，正是要的东西。
 */
function damaiSearchUrl(keyword) {
  return `https://m.damai.cn/shows/search.html?keyword=${encodeURIComponent(String(keyword || "").trim())}`;
}

// 这几类场馆的问题是「今晚演什么」，交给大麦；其余的问题是「这是个什么地方」，交给点评。
// 剧场的官网尤其难找——搜出来几乎全是自称「XX剧场官网」的票务代理站，一个都不能挂。
const TICKETED_VENUE = new Set(["剧场", "Live House / 夜店"]);

/**
 * 地名本身点进哪儿。
 *
 * 有官网就进官网。没有的话不进地图——地图回答的是「在哪」，可名字这个位置
 * 问的是「这是个什么地方」，点进去看见一个图钉等于没答。退而求其次按场馆类型
 * 分流：演出场馆进大麦，其余进大众点评，两边都能答上同一类问题。
 * 「没找到官网」这几个字不必写出来——用户要的是地方，不是我们的查找过程。
 */
function placeNameLink(place, name) {
  let href;
  if (place && place.website) {
    href = esc(place.website);
  } else if (place && TICKETED_VENUE.has(place.subtype)) {
    href = damaiSearchUrl(name);
  } else {
    href = dianpingSearchUrl(name);
  }
  return `<a href="${href}" target="_blank" rel="noreferrer">${esc(name)}</a>`;
}

/** 一个地点的两个出口：第一个按场馆类型给官网/演出/点评，地图总是给。 */
function placeLinks(place, keyword) {
  const parts = [];
  if (place && place.website) {
    parts.push(`<a href="${esc(place.website)}" target="_blank" rel="noreferrer">官网 ↗</a>`);
  } else if (place && TICKETED_VENUE.has(place.subtype)) {
    parts.push(`<a href="${damaiSearchUrl(keyword)}" target="_blank" rel="noreferrer">演出 ↗</a>`);
  } else {
    parts.push(`<a href="${dianpingSearchUrl(keyword)}" target="_blank" rel="noreferrer">点评 ↗</a>`);
  }
  parts.push(`<a href="${mapSearchUrl(keyword)}" target="_blank" rel="noreferrer">地图 ↗</a>`);
  return parts.join(" · ");
}

/**
 * 周末方案也要走一遍「正在凑」的过程。
 *
 * 之前点完「继续」立刻就是结果，看着像早就准备好的答案——这个产品卖的是
 * 「交给命运」，过程本身就是体验的一部分。命运模式一直有摇签动画，周末方案
 * 没有，两边手感不一致。
 *
 * 和命运模式同一套做法：先把结果算出来，再倒过来演一遍。不是假装在算，
 * 是把已经定下来的东西一个个揭晓。
 */
async function startPlan() {
  const plan = buildAnchoredPlan({ people: state.party, duration: state.duration, lines: subwayLines });
  if (!plan || plan.empty || !plan.experiences.length) { showScreen("setup"); return; }

  const runId = ++rollRunId;
  rollLog.replaceChildren();
  showScreen("roll");

  const where = plan.kind === "outskirts" ? plan.destination.name
    : plan.station ? plan.station.station_name : "城里";
  const pool = fortuneCandidates(subwayLines).map((c) => c.station.station_name);
  addLog("正在挑地方……");
  if (!await spinTo(pool.length ? pool : [where], where, "正在挑地方……", runId)) return;
  addLog(where, true);
  await wait(300);

  const names = plan.experiences.map((e) => e.name);
  const allNames = allExperiences.map((e) => e.name);
  addLog("正在排环节……");
  if (!await spinTo(allNames, names.join(" + "), "正在排环节……", runId)) return;
  addLog(names.join(" + "), true);
  if (runId !== rollRunId) return;
  await wait(350);

  planExperiences = plan.experiences.slice();
  planSteps = (plan.steps || []).slice();
  planTrip = plan.kind === "outskirts" ? plan.destination : null;
  planRoute = plan.kind === "route" ? plan.route : null;
  planStation = plan.station ? { station: plan.station, line: plan.line } : null;
  planSwapCounts = planExperiences.map(() => 0);
  planModuleHistory = planExperiences.map(() => []);
  renderPlan();
  showScreen("plan");
}

function scopeLabel(scope) { return scope === "suburban" ? "京郊" : scope === "urban" ? "城市" : "城市 / 京郊"; }

function renderPlan() {
  const container = document.getElementById("plan-list");
  container.replaceChildren();
  const where = planTrip ? ` · 🚗 出城 · ${planTrip.name}`
    : planRoute ? ` · 🚶 ${planStation.line.line_name} ${planStation.station.station_name}出发`
    : planStation ? ` · ${planStation.line.line_name} ${planStation.station.station_name}一带` : "";
  document.getElementById("plan-subtitle").textContent =
    `${state.party} · ${state.duration}${where} · 共 ${planExperiences.length} 个环节`;
  planExperiences.forEach((exp, i) => {
    const card = document.createElement("article");
    card.className = "place-card plan-card " + (exp.role === "support" ? "is-support" : "is-core");
    const step = planSteps[i];
    const isRoute = step && step.placeMode === "route";
    const swapped = planSwapCounts[i] >= 3;
    const tags = (exp.vibe || []).map((v) => `<span class="tag">${esc(v)}</span>`).join("");

    // 层级：地名是主角，玩法是标签。
    //
    // 原先反过来——「鸡尾酒活动」是大标题，「CONTAINER BEER SHOP」缩在灰色小字里。
    // 用户看完根本没注意到被推荐的是哪家店。真正要记住、要搜、要去的是地名。
    let lead = esc(exp.name);          // 卡片主标题
    let sub = "";                      // 主标题下面那行
    let extra = "";                    // 再下面的补充

    if (isRoute) {
      const r = step.route;
      lead = esc(r.name);
      const stops = (r.stops || []).map(esc).join(" → ");
      const meta = [r.length, r.duration].filter(Boolean).join(" · ");
      sub = `${esc(r.start_station || "")}站出发` + (stops ? ` → ${stops}` : "")
        + (meta ? ` · ${esc(meta)}` : "");
      extra = r.highlight ? esc(r.highlight) : "";
    } else if (step && step.placeMode === "outskirts") {
      lead = placeNameLink(step.place, step.place.name);
      sub = (i === 0 ? esc(exp.sub_type || exp.main_type) : "和上一项同一个地方")
        + ` · <a class="plan-map" href="${mapSearchUrl(step.place.name)}" target="_blank" rel="noreferrer">📍 地图</a>`;
      extra = step.hint ? esc(step.hint) : "";
    } else if (step && step.placeMode === "area") {
      // 手作这一类不指定店：OSM 收不到工作室和体验课，硬挂一个商场就是编的
      // ——「凯德MALL 不一定有乐器体验课」。这一带确实能找到，具体哪家交给你搜。
      const spot = planStation ? `${planStation.station.station_name}一带` : "这一带";
      const query = `${spot.replace("一带", "")} ${exp.name}`;
      lead = `<a href="${dianpingSearchUrl(query)}" target="_blank" rel="noreferrer">${esc(spot)}</a>`;
      sub = `${esc(exp.sub_type || exp.main_type)} · 点开在大众点评搜这一带的店`;
      extra = step.hint ? esc(step.hint) : "";
    } else if (step && step.place) {
      const metres = Math.round(step.place.distance_km * 1000);
      // 名字点进官网，没官网就按场馆类型进大麦或点评；地图单独一个按钮。
      lead = placeNameLink(step.place, step.place.name);
      sub = `步行约 ${metres} 米`
        + ` · <a class="plan-map" href="${mapSearchUrl(step.place.name)}" target="_blank" rel="noreferrer">📍 地图</a>`;
      extra = step.hint ? esc(step.hint) : "";
    } else {
      sub = "地点你定";
      extra = step && step.hint ? esc(step.hint) : "";
    }

    const role = exp.role === "support" ? "顺带" : "主玩";
    const kind = isRoute ? "路线" : esc(exp.sub_type || exp.main_type);
    card.innerHTML = `
      <p class="plan-kicker"><span class="plan-role">${role}</span><span class="plan-exp">${esc(exp.name)}</span>
        ${isRoute ? "" : `<span class="plan-kind">${kind}</span>`}</p>
      <h3 class="plan-place">${lead}</h3>
      ${sub ? `<p class="plan-sub">${sub}</p>` : ""}
      ${extra ? `<p class="plan-extra">${extra}</p>` : ""}
      ${isRoute ? "" : `<p class="plan-time">⏱ ${exp.duration_min}–${exp.duration_max} 分钟</p>`}
      ${tags ? `<p class="plan-vibe">${tags}</p>` : ""}
      ${isRoute ? "" : `<button class="btn btn-ghost btn-swap" type="button" data-index="${i}" ${swapped ? "disabled" : ""}>${swapped ? "命运已定 ✦" : "换一个"}</button>`}`;
    container.append(card);
  });
  if (planTrip) {
    // 出城方案得说清楚有多远——「一天或以上」不等于「地铁能到」
    const note = document.createElement("p");
    note.className = "place-freshness";
    note.innerHTML = `这几件事都在 ${esc(planTrip.name)}，地铁到不了——最近的是 `
      + `${esc(planTrip.nearest_station)}站，还有 ${Math.round(planTrip.nearest_km)} 公里，得开车`
      + ` · <a href="${mapSearchUrl(planTrip.name)}" target="_blank" rel="noreferrer">地图 ↗</a>`;
    container.append(note);
  }
  // 周末方案同样吃 OSM 的数据，ODbL 的署名义务在这一屏也成立。
  // 地图链接改成跳高德之后更要标——不标的话这份数据从哪来就无从得知了。
  const credit = document.createElement("p");
  credit.className = "place-freshness";
  credit.innerHTML = `场所数据来自 <a href="${poiSource.url}" target="_blank" rel="noreferrer">${poiSource.name}</a>`
    + `（${poiSource.license}），另含人工整理的地点；地图跳转由高德提供`;
  container.append(credit);

  container.querySelectorAll(".btn-swap").forEach((btn) => btn.addEventListener("click", () => swapModule(Number(btn.dataset.index))));
}

function swapModule(i) {
  if (i < 0 || i >= planExperiences.length || planSwapCounts[i] >= 3) return;
  if (planTrip) { swapTripModule(i); return; }
  if (!planStation) return;
  const role = planExperiences[i].role;
  // 只在「这一站附近能落地」的玩法里换，否则换完就退回「地点你定」
  const takenPlaces = planSteps.filter((s, j) => j !== i && s && s.place).map((s) => s.place.id);
  const pool = placeableExperiencesAt(planStation.station, { people: state.party, duration: state.duration, role, taken: takenPlaces });
  const exclude = new Set([...planExperiences.map((e) => e.id), ...planModuleHistory[i]]);
  let options = pool.filter((e) => !exclude.has(e.id));
  if (!options.length) options = pool.filter((e) => e.id !== planExperiences[i].id);
  if (!options.length) return;
  const next = options[Math.floor(Math.random() * options.length)];
  planModuleHistory[i].push(planExperiences[i].id);
  planExperiences[i] = next;
  planSwapCounts[i] += 1;
  // 换了玩法，这一环的地点也要跟着换——否则会挂着上一个玩法的地点
  if (planSteps[i] && planStation) {
    const rematched = matchPlaceFor(next, planStation.station, new Set(takenPlaces));
    planSteps[i] = { ...planSteps[i], ...rematched };
  }
  renderPlan();
}

function restoreSession() {
  const saved = sessionStorage.getItem(STORAGE_KEY); if (!saved) return restoreSelectionUI();
  try {
    const previous = JSON.parse(saved); Object.assign(state, previous.state); navigationStack = previous.navigationStack || []; restoreSelectionUI();
    if (previous.currentScreen === "recent") { renderRecent(); showScreen("recent", { remember: false }); return; }
    if (previous.currentScreen === "pick") { renderPick(); showScreen("pick", { remember: false }); return; }
    if (previous.currentScreen === "plan") { showScreen("setup", { remember: false }); return; }
    if (previous.currentScreen === "result" && state.destination && (state.mode !== "wander" || state.result)) { renderResult(); showScreen("result", { remember: false }); return; }
    // 刷新时不伪造未完成动画，回到可继续的条件页。
    showScreen(previous.currentScreen === "roll" ? "setup" : (previous.currentScreen || "home"), { remember: false });
  } catch { sessionStorage.removeItem(STORAGE_KEY); restoreSelectionUI(); }
}

/* recent 模式交互绑定（不改动命运/随便逛逛/locked 等其它屏幕） */
document.getElementById("recent-cats").querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => {
  recentCat = chip.dataset.cat;
  document.getElementById("recent-cats").querySelectorAll(".chip").forEach((c) => { const on = c === chip; c.classList.toggle("is-selected", on); c.setAttribute("aria-selected", String(on)); });
  renderRecent();
}));
document.getElementById("recent-district").addEventListener("change", (e) => { recentDistrict = e.target.value; renderRecent(); });
document.getElementById("btn-recent-pick").addEventListener("click", () => { renderPick(); showScreen("pick"); });
document.getElementById("btn-pick-go").addEventListener("click", () => { if (currentPick && currentPick.source_url) window.open(currentPick.source_url, "_blank", "noreferrer"); });
document.getElementById("btn-pick-again").addEventListener("click", () => { renderPick(); });
populateDistricts();

/* plan 模式交互绑定（不改动命运/随便逛逛/recent/locked 等其它屏幕） */
document.getElementById("btn-plan-lock").addEventListener("click", () => {
  lockWith("周末方案已经锁定。出门就好。",
           document.getElementById("plan-list"));
});
document.getElementById("btn-plan-regenerate").addEventListener("click", startPlan);

restoreSession();
