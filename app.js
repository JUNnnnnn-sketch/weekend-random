import { subwayLines } from "./data/subway.js";
import { places } from "./data/places.js";
import { activities } from "./data/activities.js";
import { pickDestination, randomItem, recommend, freshness } from "./recommendation.js";

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
  if (name === "setup") document.getElementById("setup-title").textContent = state.mode === "fortune" ? "先告诉命运一点情报" : "先告诉这次怎么探索";
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

function setupMode(mode) { state.mode = mode; document.getElementById("setup-title").textContent = mode === "fortune" ? "先告诉命运一点情报" : "先告诉这次怎么探索"; showScreen("setup"); }
document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.mode === "recent") { state.mode = "recent"; showScreen("recent"); return; } setupMode(button.dataset.mode); }));
document.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => { state[chip.dataset.group] = chip.dataset.value; restoreSelectionUI(); saveSession(); }));
document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", goBack));
document.querySelectorAll("[data-home]").forEach((button) => button.addEventListener("click", goHome));
document.getElementById("btn-continue").addEventListener("click", startRoll);
document.getElementById("btn-retry").addEventListener("click", startRoll);
document.getElementById("btn-accept").addEventListener("click", () => { document.querySelector("#screen-locked .subtitle").textContent = `${state.destination.name} 已经锁定。出门就好。`; showScreen("locked"); });
document.getElementById("btn-home").addEventListener("click", goHome);

async function spinTo(pool, finalValue, status, runId) {
  rollStatus.textContent = status; reel.classList.add("is-spinning");
  for (let index = 0; index < 12; index += 1) { if (runId !== rollRunId) return false; reelValue.textContent = pool[index % pool.length]; await wait(75 + index * 7); }
  reel.classList.remove("is-spinning"); reelValue.textContent = finalValue; return true;
}

async function startRoll() {
  const runId = ++rollRunId; rollLog.replaceChildren(); const isFortune = state.mode === "fortune";
  document.getElementById("roll-kicker").textContent = isFortune ? "命运正在抽签" : "探索路线正在生成";
  showScreen("roll");
  if (isFortune) {
    const destination = pickDestination(subwayLines);
    state.destination = { ...destination.station, name: destination.station.name, lineName: destination.line.name, kind: "station" };
    addLog("正在决定地铁线……"); if (!await spinTo(subwayLines.map((line) => line.name), destination.line.name, "正在决定地铁线……", runId)) return;
    addLog(destination.line.name, true); await wait(350); addLog("正在决定车站……");
    if (!await spinTo(destination.line.stations.map((station) => station.name), destination.station.name, "正在决定车站……", runId)) return;
    addLog(destination.station.name, true);
  } else {
    const area = randomItem(places);
    state.destination = { ...area, name: area.name, kind: "area" };
    addLog("正在决定探索区域……"); if (!await spinTo(places.map((place) => place.name), area.name, "正在决定探索区域……", runId)) return;
    addLog(area.name, true); await wait(350); addLog("正在生成轻量探索任务……");
    if (!await spinTo(["慢一点", "绕个弯", "抬头看", "随意走"], "去看看", "正在生成轻量探索任务……", runId)) return;
  }
  if (runId !== rollRunId) return;
  await wait(350); addLog("正在筛选附近真实地点……"); rollStatus.textContent = "正在筛选附近真实地点……"; reelValue.textContent = "⌕"; reel.classList.add("is-spinning"); await wait(800); reel.classList.remove("is-spinning");
  if (runId !== rollRunId) return;
  state.result = recommend({ destination: state.destination, people: state.party, duration: state.duration, places, activities }); renderResult(); showScreen("result");
}

function renderResult() {
  const { picks, candidates, radius } = state.result; const wander = state.mode === "wander";
  document.querySelector("#screen-result .actions").hidden = false;
  document.getElementById("result-kicker").textContent = wander ? "这一带，值得逛逛" : "命运已揭晓";
  document.querySelector(".result-title").innerHTML = wander ? "🗺️ 今日探索区域<br /><span id=\"result-station\"></span>" : "🎯 今天的目的地<br /><span id=\"result-station\"></span>";
  document.getElementById("result-station").textContent = state.destination.name;
  document.getElementById("result-meta").textContent = wander ? `${state.party} · ${state.duration} · 在区域周边 ${radius} km 内探索` : `${state.party} · ${state.duration} · ${state.destination.lineName} · 搜索半径 ${radius} km`;
  const task = document.getElementById("explore-task"); task.hidden = !wander;
  task.innerHTML = wander ? `<p class="place-category">轻量探索任务</p><strong>在 ${state.destination.name} 附近，离开主路走 15 分钟；遇到一家以前没进过的店或一个想停留的角落，就进去看看。</strong>` : "";
  const list = document.getElementById("place-list"); list.replaceChildren();
  if (!candidates.length) { list.innerHTML = '<p class="empty">当前测试数据中，没有符合条件的真实地点。系统不会编造推荐；换个条件或再抽一次吧。</p>'; return; }
  picks.forEach((item) => list.append(renderPlace(item)));
}
function renderPlace(item) {
  const card = document.createElement("article"); card.className = "place-card";
  card.innerHTML = `<div><p class="place-category">${item.category}</p><h3>${item.name}</h3></div><p>${item.category} · ${state.party}</p><p>距离 ${item.distance_km.toFixed(1)} km · 约 ${state.duration}</p><p class="place-freshness">数据${freshness(item.updated_at)}</p><a href="${item.source_url}" target="_blank" rel="noreferrer">查看数据来源 ↗</a>`;
  return card;
}
function restoreSession() {
  const saved = sessionStorage.getItem(STORAGE_KEY); if (!saved) return restoreSelectionUI();
  try {
    const previous = JSON.parse(saved); Object.assign(state, previous.state); navigationStack = previous.navigationStack || []; restoreSelectionUI();
    if (previous.currentScreen === "result" && state.result && state.destination) { renderResult(); showScreen("result", { remember: false }); return; }
    // 刷新时不伪造未完成动画，回到可继续的条件页。
    showScreen(previous.currentScreen === "roll" ? "setup" : (previous.currentScreen || "home"), { remember: false });
  } catch { sessionStorage.removeItem(STORAGE_KEY); restoreSelectionUI(); }
}
restoreSession();
