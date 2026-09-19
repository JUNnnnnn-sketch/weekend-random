import { subwayLines } from "./data/subway.js";
import { activities, activityDataAsOf } from "./data/activities.js";
import { pickDestination, freshness, buildWeekendPlan, pickExperience } from "./recommendation.js";

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
  if (name === "roll") document.getElementById("roll-kicker").textContent = state.mode === "fortune" ? "命运正在抽签" : "探索路线正在生成";
  Object.entries(screens).forEach(([key, screen]) => { const active = key === name; screen.classList.toggle("is-active", active); screen.toggleAttribute("hidden", !active); screen.setAttribute("aria-hidden", String(!active)); });
  saveSession();
}
function goBack() { rollRunId += 1; showScreen(navigationStack.pop() || "home", { remember: false }); }
function goHome() { rollRunId += 1; navigationStack = []; showScreen("home", { remember: false }); }
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function addLog(text, done = false) { const item = document.createElement("li"); item.textContent = text; item.classList.toggle("is-done", done); rollLog.append(item); }
function updateContinue() { continueBtn.disabled = !(state.party && state.duration); }
function restoreSelectionUI() { document.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("is-selected", state[chip.dataset.group] === chip.dataset.value)); updateContinue(); }

function setupTitleFor(mode) { return mode === "fortune" ? "先告诉命运一点情报" : mode === "plan" ? "先告诉它会怎么过" : "先告诉这次怎么探索"; }
function setupMode(mode) { state.mode = mode; document.getElementById("setup-title").textContent = setupTitleFor(mode); showScreen("setup"); }
document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.mode === "recent") { state.mode = "recent"; showScreen("recent"); renderRecent(); return; } setupMode(button.dataset.mode); }));
document.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => { state[chip.dataset.group] = chip.dataset.value; restoreSelectionUI(); saveSession(); }));
document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", goBack));
document.querySelectorAll("[data-home]").forEach((button) => button.addEventListener("click", goHome));
document.getElementById("btn-continue").addEventListener("click", () => { if (state.mode === "plan") { startPlan(); return; } startRoll(); });
document.getElementById("btn-retry").addEventListener("click", startRoll);
document.getElementById("btn-accept").addEventListener("click", () => { document.querySelector("#screen-locked .subtitle").textContent = `${state.destination.label || state.destination.name} 已经锁定。出门就好。`; showScreen("locked"); });
document.getElementById("btn-home").addEventListener("click", goHome);

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
// 以数据基准日为锚（快照模式固定为抓取日；联网脚本会写为运行当日），避免用浏览器实时日期误判静态快照
function activityRefDate() { const [Y, M, D] = activityDataAsOf.split("-").map(Number); return new Date(Y, M - 1, D); }
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
function dateKey(a) { const sd = parseActivityDate(a.start_date); if (sd) return sd.getTime(); const ed = parseActivityDate(a.end_date); return ed ? ed.getTime() : Infinity; }
function filterSortActivities() {
  const ref = activityRefDate();
  const plus7 = new Date(ref); plus7.setDate(ref.getDate() + 7);
  let list = activities.filter((a) => isShowable(a, ref, plus7));
  const want = CAT_TABS[recentCat];
  if (want) list = list.filter((a) => a.category === want);
  if (recentDistrict && recentDistrict !== "全部") list = list.filter((a) => a.district === recentDistrict);
  // 排序：即将开始(0) → 正在进行(1) → 日期待定(2)；同组按开始日期升序；再随机打散（每次打开顺序不同）
  return list.slice().sort((x, y) => {
    const rx = activityStatusRank(x, ref, plus7), ry = activityStatusRank(y, ref, plus7);
    if (rx !== ry) return rx - ry;
    const dx = dateKey(x), dy = dateKey(y);
    if (dx !== dy) return dx - dy;
    return Math.random() - 0.5;
  });
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
  const list = filterSortActivities();
  const container = document.getElementById("activity-list");
  container.replaceChildren();
  document.getElementById("recent-empty").hidden = list.length > 0;
  list.forEach((a) => container.append(renderActivityCard(a)));
}
function pickRandomActivity() {
  const ref = activityRefDate();
  const plus7 = new Date(ref); plus7.setDate(ref.getDate() + 7);
  const pool = activities.filter((a) => isShowable(a, ref, plus7) && a.source_url);
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
  const districts = [...new Set(activities.map((a) => a.district).filter(Boolean))].sort();
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
  // 命运模式只做一件事：随机线路 -> 随机站点。不看坐标，也不在这里找“附近有什么”。
  const picked = pickDestination(subwayLines);
  if (!picked) { addLog("暂时没有可用的地铁线路数据", true); return; }
  const { line, station, destination } = picked;
  state.destination = destination;
  addLog("正在决定地铁线……"); if (!await spinTo(subwayLines.map((item) => item.line_name), line.line_name, "正在决定地铁线……", runId)) return;
  addLog(line.line_name, true); await wait(350); addLog("正在决定车站……");
  if (!await spinTo(line.stations.map((item) => item.station_name), station.station_name, "正在决定车站……", runId)) return;
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
  const { line_name, station_order, has_coordinates } = state.destination;
  document.getElementById("result-meta").textContent = `${state.party} · ${state.duration} · ${line_name} 第 ${station_order} 站`;
  document.getElementById("explore-task").hidden = true;
  document.querySelector(".result-lead").textContent = "🚇 下一步";
  const list = document.getElementById("place-list"); list.replaceChildren();
  const card = document.createElement("article"); card.className = "place-card";
  const coordNote = has_coordinates ? "" : '<p class="place-freshness">这个站还没有公开坐标，不影响它成为今天的目的地。</p>';
  card.innerHTML = `<div><p class="place-category">下一步</p><h3>看看附近有什么</h3></div><p>目的地已经定了。附近玩法还没接入可核验的数据，接上之后会在这里展开。</p>${coordNote}<button class="btn btn-ghost" type="button" disabled>看看附近有什么（即将开放）</button>`;
  list.append(card);
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

function startPlan() {
  const plan = buildWeekendPlan({ people: state.party, duration: state.duration });
  if (!plan || plan.empty || !plan.experiences.length) { showScreen("setup"); return; }
  planExperiences = plan.experiences.slice();
  planSwapCounts = planExperiences.map(() => 0);
  planModuleHistory = planExperiences.map(() => []);
  renderPlan();
  showScreen("plan");
}

function scopeLabel(scope) { return scope === "suburban" ? "京郊" : scope === "urban" ? "城市" : "城市 / 京郊"; }

function renderPlan() {
  const container = document.getElementById("plan-list");
  container.replaceChildren();
  document.getElementById("plan-subtitle").textContent = `${state.party} · ${state.duration} · 共 ${planExperiences.length} 个玩法`;
  planExperiences.forEach((exp, i) => {
    const card = document.createElement("article");
    card.className = "place-card plan-card " + (exp.role === "support" ? "is-support" : "is-core");
    const isSupport = exp.role === "support";
    const swapped = planSwapCounts[i] >= 3;
    const tags = (exp.vibe || []).map((v) => `<span class="tag">${esc(v)}</span>`).join("");
    card.innerHTML = `
      <div><p class="place-category">${isSupport ? "辅助活动" : "核心活动"}</p><h3>${esc(exp.name)}</h3></div>
      <p class="activity-meta">${esc(exp.main_type)} · ${esc(exp.sub_type || "")}</p>
      <p class="activity-date">⏱ ${exp.duration_min}–${exp.duration_max} 分钟 · ${scopeLabel(exp.location_scope)}</p>
      ${tags ? `<p class="plan-vibe">${tags}</p>` : ""}
      <button class="btn btn-ghost btn-swap" type="button" data-index="${i}" ${swapped ? "disabled" : ""}>${swapped ? "命运已定 ✦" : "换一个"}</button>`;
    container.append(card);
  });
  container.querySelectorAll(".btn-swap").forEach((btn) => btn.addEventListener("click", () => swapModule(Number(btn.dataset.index))));
}

function swapModule(i) {
  if (i < 0 || i >= planExperiences.length || planSwapCounts[i] >= 3) return;
  const role = planExperiences[i].role;
  const displayedIds = planExperiences.map((e) => e.id);
  const exclude = [...new Set([...displayedIds, ...planModuleHistory[i]])];
  let next = pickExperience({ people: state.party, duration: state.duration, role, exclude });
  if (!next) next = pickExperience({ people: state.party, duration: state.duration, role, exclude: [planExperiences[i].id] });
  if (!next) next = pickExperience({ people: state.party, duration: state.duration, role });
  if (!next) return;
  planModuleHistory[i].push(planExperiences[i].id);
  planExperiences[i] = next;
  planSwapCounts[i] += 1;
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
  document.querySelector("#screen-locked .subtitle").textContent = "你的周末方案已经锁定。出门就好。";
  showScreen("locked");
});
document.getElementById("btn-plan-regenerate").addEventListener("click", startPlan);

restoreSession();
