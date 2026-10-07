// ============================================================
//  玩法 -> 真实地点 的映射
// ============================================================
//  周末方案原先只输出抽象玩法（「桌游」「博物馆」），没有地点也没有内容。
//  这张表把每条玩法接到 data/station_pois.js 里的真实场所上。
//
//  三种处理，依据是「换一家店，体验会不会变」：
//
//  anchor  —— 给具体地点。换一家区别很大，或者场地本身稀缺。
//             博物馆、剧场、Live House、酒吧、攀岩、卡丁车、马术、台球、KTV。
//
//  area    —— 给商圈/街区，不指定店。手作类换哪家工作室区别不大，但在哪片
//             区别很大：798 适合艺术类，国子监、南锣鼓巷一带适合汉服拍摄。
//
//  (缺省) —— 不给地点。桌游、剧本杀、密室这类确实哪家都行；
//             滑冰、射箭、保龄球、下午茶则是想给而给不了——实测 OSM 里
//             滑冰只有 2 条（其中一条还是轮滑场）、射箭和保龄球各 1 家，
//             下午茶查到的全是吴裕泰、张一元这类茶叶店。宁可不给，不编。
//
//  「看夜景」「胡同夜游」「爬山」这类氛围/风景型玩法同样缺省——它们必须有
//  具体地点才成立（「去东交民巷看老建筑配秋叶」的价值全在那个地点上），
//  但这需要一份人工整理的氛围地点表，不在本文件范围内。
// ============================================================

/** 按 POI 的 subtype 取地点。键是 experiences.js 里的 name。 */
export const EXPERIENCE_PLACES = {
  // ---- 文化 / 奇趣探索：博物馆与美术馆 ----
  "奇趣博物馆": { mode: "anchor", subtypes: ["博物馆"] },
  "艺术博物馆": { mode: "anchor", subtypes: ["博物馆", "美术馆 / 画廊"] },
  "历史博物馆": { mode: "anchor", subtypes: ["博物馆"] },
  "科技博物馆": { mode: "anchor", subtypes: ["博物馆"] },
  "自然博物馆": { mode: "anchor", subtypes: ["博物馆"] },
  "军事博物馆": { mode: "anchor", subtypes: ["博物馆"] },
  "汽车博物馆": { mode: "anchor", subtypes: ["博物馆"] },
  "工业博物馆": { mode: "anchor", subtypes: ["博物馆"] },
  "食物博物馆": { mode: "anchor", subtypes: ["博物馆"] },
  "民俗博物馆": { mode: "anchor", subtypes: ["博物馆"] },
  "冷门博物馆": { mode: "anchor", subtypes: ["博物馆"] },
  "普通主题博物馆": { mode: "anchor", subtypes: ["博物馆"] },
  "美术馆": { mode: "anchor", subtypes: ["美术馆 / 画廊"] },
  "小众展览": { mode: "anchor", subtypes: ["美术馆 / 画廊", "艺术中心"] },
  "特色文化空间": { mode: "anchor", subtypes: ["艺术中心", "书店", "图书馆"] },
  "奇怪的主题展览": { mode: "anchor", subtypes: ["美术馆 / 画廊", "艺术中心"] },

  // ---- 音乐 / 舞台 / 夜生活 ----
  "Live House": { mode: "anchor", subtypes: ["Live House / 夜店"] },
  "爵士现场": { mode: "anchor", subtypes: ["Live House / 夜店", "酒吧"] },
  "音乐厅": { mode: "anchor", subtypes: ["剧场"] },
  "剧院/话剧": { mode: "anchor", subtypes: ["剧场"] },
  "脱口秀": { mode: "anchor", subtypes: ["剧场", "Live House / 夜店"] },
  "京剧": { mode: "anchor", subtypes: ["剧场"] },
  "曲艺/小曲": { mode: "anchor", subtypes: ["剧场"] },
  "蹦迪": { mode: "anchor", subtypes: ["Live House / 夜店"] },
  "鸡尾酒活动": { mode: "anchor", subtypes: ["酒吧", "酒馆"] },
  "KTV": { mode: "anchor", subtypes: ["KTV"] },

  // ---- 放松：能落地的几项 ----
  "鸡尾酒": { mode: "anchor", subtypes: ["酒吧", "酒馆"] },
  "酒吧": { mode: "anchor", subtypes: ["酒吧", "酒馆"] },

  // ---- 游戏 / 轻刺激：场地稀缺、必须给地点的 ----
  "攀岩体验": { mode: "anchor", subtypes: ["攀岩"] },
  "卡丁车": { mode: "anchor", subtypes: ["卡丁车"] },
  "台球": { mode: "anchor", subtypes: ["台球"] },
  "骑马体验": { mode: "anchor", subtypes: ["马术"] },

  // ---- 乐园 / 大型目的地、赛事 ----
  "大型园区/植物园": { mode: "anchor", subtypes: ["公园", "园林", "自然保护区"] },
  "动物园": { mode: "anchor", subtypes: ["动物园"] },
  "赛车观赛": { mode: "anchor", subtypes: ["体育场馆"] },
  "马术观赛": { mode: "anchor", subtypes: ["马术", "体育场馆"] },
  "花滑观赛": { mode: "anchor", subtypes: ["体育场馆"] },
  "电竞观赛": { mode: "anchor", subtypes: ["体育场馆"] },
  "其他低门槛现场赛事": { mode: "anchor", subtypes: ["体育场馆"] },

  // ---- 手作 / 体验：给商圈，不指定店 ----
  "陶艺": { mode: "area", hint: "艺术区一带的工作室最多" },
  "首饰制作": { mode: "area", hint: "文创园区里常有" },
  "花艺": { mode: "area" },
  "烘焙体验": { mode: "area" },
  "DIY": { mode: "area" },
  "绘画体验": { mode: "area", hint: "艺术区一带选择最多" },
  "香水制作": { mode: "area" },
  "调酒体验": { mode: "area" },
  "乐器体验课": { mode: "area" },
  "汉服体验": { mode: "area", hint: "古建与胡同一带出片" },
  "摄影体验": { mode: "area", hint: "老街区与艺术区都合适" },
  "其他体验课": { mode: "area" },
};

/** area 模式去哪些品类里挑街区。 */
export const AREA_CATEGORIES = ["🧭 特色去处", "🛍 商场 / 商圈"];

/** 查某个玩法该怎么给地点；没登记的就是「不给地点」。 */
export function placeRuleFor(experienceName) {
  return EXPERIENCE_PLACES[experienceName] || null;
}
