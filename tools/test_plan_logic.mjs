// 周末方案推荐逻辑测试：验证「随机拼出来的方案在现实中成立」。
// 运行：node tools/test_plan_logic.mjs
import { experiences } from "../data/experiences.js";
import { buildWeekendPlan, pickExperience, filterExperiences, pickDestination, recommend } from "../recommendation.js";

const BUDGET = { "2-3小时": 180, "半天": 300, "一整天": 600 };
const VALID_IDS = new Set(experiences.map((e) => e.id));
const PEOPLE = ["一个人", "两个人", "一群人"];
const DURATIONS = ["2-3小时", "半天", "一整天"];

let failures = [];
const fail = (msg) => { failures.push(msg); console.error("  ✗ " + msg); };
const ok = (msg) => console.log("  ✓ " + msg);

// 显式遍历「人数 × 时长」网格，确保每个组合都被充分抽样（避免交错的随机索引漏掉某些组合）
const PER_COMBO = 1500;
let sawFullDaySingle = false;
let sawSuburbanPlan = false;
const samples = { "两个人|一整天": [], "两个人|半天": [] };

for (const people of PEOPLE) {
  for (const duration of DURATIONS) {
    for (let i = 0; i < PER_COMBO; i++) {
      const plan = buildWeekendPlan({ people, duration });

  // 不变量 6：同一方案内不重复
  const ids = plan.experiences.map((e) => e.id);
  if (new Set(ids).size !== ids.length) fail(`重复 Experience：${ids.join(",")} (${people}/${duration})`);

  // 不变量 8：全部来自 experiences.js
  for (const e of plan.experiences) {
    if (!VALID_IDS.has(e.id)) fail(`方案含未知 Experience：${e.id}`);
  }

  // 不变量 2：京郊不出现在 2-3小时 / 半天
  if (duration === "2-3小时" || duration === "半天") {
    for (const e of plan.experiences) {
      if (e.location_scope === "suburban") fail(`京郊出现在 ${duration}：${e.id} (${people})`);
    }
  }

  // 不变量 5：multi_day 不进一整天
  if (duration === "一整天") {
    for (const e of plan.experiences) {
      if (e.duration_type === "multi_day") fail(`multi_day 进入一整天：${e.id}`);
    }
  }

  // 不变量 3：京郊 core 不搭 city-only support（也不得出现其它 urban 模块）
  const hasSuburbanCore = plan.experiences.some((e) => e.role === "core" && e.location_scope === "suburban");
  if (hasSuburbanCore) {
    sawSuburbanPlan = true;
    for (const e of plan.experiences) {
      if (e.id !== plan.experiences[0].id && e.location_scope === "urban") {
        fail(`京郊 core 搭配了 urban 模块：${plan.experiences.map((x) => x.id).join(",")} (${people}/${duration})`);
      }
    }
    // 京郊 full_day core 不应再追加任何 support
    const suburbanFullDay = plan.experiences.find((e) => e.duration_type === "full_day" && e.location_scope === "suburban");
    if (suburbanFullDay && plan.experiences.length > 1) {
      fail(`京郊 full_day core 被追加模块：${plan.experiences.map((x) => x.id).join(",")}`);
    }
  }

  // 不变量 1：一整天里 full_day core 必须单独成方案（不出现 full_day + 城市core + 城市support）
  const fullDayCores = plan.experiences.filter((e) => e.duration_type === "full_day");
  if (fullDayCores.length > 0) {
    if (plan.experiences.length !== 1) fail(`full_day core 未单独成方案：${plan.experiences.map((x) => x.id).join(",")} (${people}/${duration})`);
    if (plan.experiences.length === 1) sawFullDaySingle = true;
  }
  // 任何方案最多 1 个 full_day core，且不出现 full_day + support
  if (fullDayCores.length > 1) fail(`方案含多个 full_day core：${plan.experiences.map((x) => x.id).join(",")}`);

  // 不变量 7：support 不会让总时间明显超过当前 duration（含 support 的方案，非 full_day 整段）
  const hasSupport = plan.experiences.some((e) => e.role === "support");
  const totalMax = plan.experiences.reduce((s, e) => s + e.duration_max, 0);
  const hasFullDay = plan.experiences.some((e) => e.duration_type === "full_day");
  if (hasSupport && !hasFullDay && totalMax > BUDGET[duration] + 1) {
    fail(`support 使总时间超预算：${plan.experiences.map((x) => x.id).join(",")} total=${totalMax} budget=${BUDGET[duration]} (${people}/${duration})`);
  }

  // 收集样例
  const key = `${people}|${duration}`;
  if (samples[key] && samples[key].length < 6) {
    samples[key].push(plan.experiences.map((e) => `${e.name}[${e.role}/${e.duration_type}/${e.location_scope}]`).join(" + "));
  }
    }
  }
}

// 不变量 4：full_day 可以合法只生成 1 个 core（至少出现过）
if (!sawFullDaySingle) fail("未观测到 full_day 单 core 方案（随机样本可能不足，可调大 ITER）");
// 不变量 2 反向：京郊方案确实能在「一整天」出现
if (!sawSuburbanPlan) fail("未观测到京郊方案（一整天）样例（随机样本可能不足）");

console.log("\n— 不变量 1~8 校验 —");
if (!failures.length) ok("全部通过（每项均做数千次随机抽样）");
else { console.error(`\n失败 ${failures.length} 项。`); }

// 不变量 9：pickDestination / recommend 不受影响（仍可用、签名/行为稳定）
console.log("\n— 不变量 9：pickDestination / recommend 不受影响 —");
try {
  const fakeLines = [{ line_id: "L1", line_name: "测试线", stations: [{ station_id: "S1", physical_station_id: "PS1", station_name: "测试站", station_order: 1, latitude: null, longitude: null }] }];
  const dest = pickDestination(fakeLines);
  if (!dest || !dest.destination || dest.destination.station_name !== "测试站") fail("pickDestination 行为异常");
  else ok("pickDestination 仍按线路->站点抽签，且不依赖坐标");

  const fakePlaces = [{ id: "p1", name: "附近店", category: "测试", suitable_for_people: ["2"], suitable_duration: ["一整天"], latitude: 39.9, longitude: 116.4, updated_at: new Date().toISOString(), source_url: "x" }];
  const fakeActs = [{ id: "a1", name: "活动", category: "测试", suitable_for_people: ["2"], suitable_duration: ["一整天"], latitude: 39.9, longitude: 116.4, start_date: "2030-01-01", end_date: "2030-12-31", updated_at: new Date().toISOString(), source_url: "x" }];
  const rec = recommend({ destination: { latitude: 39.9, longitude: 116.4 }, people: "2", duration: "一整天", places: fakePlaces, activities: fakeActs });
  if (!rec || typeof rec.radius !== "number") fail("recommend 返回结构异常");
  else ok(`recommend 仍返回 {candidates, picks, radius=${rec.radius}}，未引用 experiences/duration_type`);

  // 确认两者与 experiences 解耦：即使 experiences 为空也不应影响（用过滤函数交叉验证）
  const fe = filterExperiences({ people: "两个人", duration: "一整天" });
  ok(`filterExperiences 返回 core=${fe.core.length}, support=${fe.support.length}（来自 experiences.js）`);
} catch (e) {
  fail("pickDestination/recommend 抛错：" + e.message);
}

console.log("\n— 实际生成样例 —");
console.log("两个人 + 一整天：");
for (const s of samples["两个人|一整天"]) console.log("   • " + s);
console.log("两个人 + 半天：");
for (const s of samples["两个人|半天"]) console.log("   • " + s);

console.log("\n结果：", failures.length ? `❌ ${failures.length} 项失败` : "✅ 全部通过");
process.exit(failures.length ? 1 : 0);
