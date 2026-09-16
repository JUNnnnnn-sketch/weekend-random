// ============================================================
//  Experience Taxonomy —— 周末玩法分类词典（第一版）
// ============================================================
//  这是「玩法本身」的结构化定义，不是地点库，也不是活动实时数据。
//
//  - Experience = 一类周末值得为了它出门的玩法（如「陶艺」）
//  - Place      = 具体场所（如「XX陶艺工作室」）—— 不在此文件
//  - Activity   = 具体场次（如「2026-09-20 XX陶艺体验课」）—— 见 data/activities.js
//
//  本文件描述「玩法本体」：时长、人数、体力、氛围、季节、是否需要预约、
//  是否适合第一次玩、现实约束(requirements)、能否与其他玩法组合等。
//
//  注意：
//  - 不是实时数据，不含具体营业时间/地址/价格。
//  - 不含任何「主观评分」(best/popularity/quality score)。
//  - excitement / physical_demand / novelty / first_time_friendly 是描述性属性，不是排名。
//  - 这是第一版产品设计词典，后续可继续增加玩法（保持字段结构一致即可）。
//
//  字段定义见同目录 EXPERIENCE_README.md。
// ============================================================

export const experiences = [
  {
    "id": "music_festival",
    "name": "音乐节",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "户外音乐节",
    "role": "core",
    "duration_min": 360,
    "duration_max": 720,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "both",
    "vibe": [
      "wild",
      "high_energy",
      "outdoors",
      "social"
    ],
    "physical_demand": "medium",
    "excitement": 3,
    "season": "summer",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "event_scheduled"
    ],
    "combinable": false,
    "novelty": "special"
  },
  {
    "id": "live_house",
    "name": "Live House",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "现场演出",
    "role": "core",
    "duration_min": 120,
    "duration_max": 240,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "night",
      "high_energy",
      "social"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "jazz_live",
    "name": "爵士现场",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "现场演出",
    "role": "core",
    "duration_min": 120,
    "duration_max": 180,
    "suitable_people": [
      "2"
    ],
    "location_scope": "urban",
    "vibe": [
      "night",
      "chill",
      "romantic",
      "aesthetic"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "concert",
    "name": "演唱会",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "大型演出",
    "role": "core",
    "duration_min": 120,
    "duration_max": 240,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "high_energy",
      "social",
      "night"
    ],
    "physical_demand": "low",
    "excitement": 3,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "event_scheduled"
    ],
    "combinable": false,
    "novelty": "normal"
  },
  {
    "id": "concert_hall",
    "name": "音乐厅",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "古典/交响",
    "role": "core",
    "duration_min": 120,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "chill",
      "aesthetic",
      "nostalgic"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "event_scheduled"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "theater",
    "name": "剧院/话剧",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "戏剧",
    "role": "core",
    "duration_min": 120,
    "duration_max": 180,
    "suitable_people": [
      "2"
    ],
    "location_scope": "urban",
    "vibe": [
      "aesthetic",
      "nostalgic",
      "immersive"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "event_scheduled"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "standup",
    "name": "脱口秀",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "开放麦/商演",
    "role": "core",
    "duration_min": 90,
    "duration_max": 150,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "social",
      "young",
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "beijing_opera",
    "name": "京剧",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "传统戏曲",
    "role": "core",
    "duration_min": 120,
    "duration_max": 180,
    "suitable_people": [
      "2"
    ],
    "location_scope": "urban",
    "vibe": [
      "nostalgic",
      "aesthetic"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "event_scheduled"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "quyi",
    "name": "曲艺/小曲",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "传统曲艺",
    "role": "core",
    "duration_min": 90,
    "duration_max": 150,
    "suitable_people": [
      "2"
    ],
    "location_scope": "urban",
    "vibe": [
      "nostalgic",
      "aesthetic"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "event_scheduled"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "party",
    "name": "派对",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "私人/主题派对",
    "role": "core",
    "duration_min": 180,
    "duration_max": 300,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "night",
      "high_energy",
      "social",
      "wild"
    ],
    "physical_demand": "medium",
    "excitement": 3,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": false,
    "novelty": "normal"
  },
  {
    "id": "clubbing",
    "name": "蹦迪",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "夜店",
    "role": "core",
    "duration_min": 120,
    "duration_max": 300,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "night",
      "high_energy",
      "wild"
    ],
    "physical_demand": "medium",
    "excitement": 3,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": false,
    "novelty": "normal"
  },
  {
    "id": "cocktail_event",
    "name": "鸡尾酒活动",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "品鉴/调酒秀",
    "role": "core",
    "duration_min": 120,
    "duration_max": 180,
    "suitable_people": [
      "2"
    ],
    "location_scope": "urban",
    "vibe": [
      "night",
      "social",
      "creative",
      "aesthetic"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "event_scheduled"
    ],
    "combinable": true,
    "novelty": "special"
  },
  {
    "id": "ktv",
    "name": "KTV",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "量贩/商务KTV",
    "role": "core",
    "duration_min": 120,
    "duration_max": 240,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "social",
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "themed_party",
    "name": "主题派对",
    "main_type": "音乐/舞台/夜生活",
    "sub_type": "变装/主题派对",
    "role": "core",
    "duration_min": 180,
    "duration_max": 300,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "night",
      "social",
      "creative",
      "wild",
      "weird"
    ],
    "physical_demand": "medium",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": false,
    "novelty": "special"
  },
  {
    "id": "pottery",
    "name": "陶艺",
    "main_type": "手作/体验",
    "sub_type": "陶艺拉坯",
    "role": "core",
    "duration_min": 120,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "creative",
      "chill"
    ],
    "physical_demand": "medium",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "jewelry",
    "name": "首饰制作",
    "main_type": "手作/体验",
    "sub_type": "银饰/串珠",
    "role": "core",
    "duration_min": 120,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "creative",
      "aesthetic"
    ],
    "physical_demand": "medium",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "floral",
    "name": "花艺",
    "main_type": "手作/体验",
    "sub_type": "花艺/插花",
    "role": "core",
    "duration_min": 90,
    "duration_max": 150,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "creative",
      "aesthetic",
      "romantic"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "baking",
    "name": "烘焙体验",
    "main_type": "手作/体验",
    "sub_type": "甜点/面包",
    "role": "core",
    "duration_min": 120,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "creative",
      "chill"
    ],
    "physical_demand": "medium",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "diy",
    "name": "DIY",
    "main_type": "手作/体验",
    "sub_type": "综合手作",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "creative"
    ],
    "physical_demand": "medium",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "painting",
    "name": "绘画体验",
    "main_type": "手作/体验",
    "sub_type": "油画/水彩",
    "role": "core",
    "duration_min": 120,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "creative",
      "aesthetic",
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "perfume",
    "name": "香水制作",
    "main_type": "手作/体验",
    "sub_type": "调香",
    "role": "core",
    "duration_min": 90,
    "duration_max": 150,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "creative",
      "aesthetic"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "special"
  },
  {
    "id": "bartending",
    "name": "调酒体验",
    "main_type": "手作/体验",
    "sub_type": "家庭调酒课",
    "role": "core",
    "duration_min": 90,
    "duration_max": 150,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "creative",
      "social"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "special"
  },
  {
    "id": "instrument_lesson",
    "name": "乐器体验课",
    "main_type": "手作/体验",
    "sub_type": "钢琴/吉他等",
    "role": "core",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "creative",
      "nerdy"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "hanfu",
    "name": "汉服体验",
    "main_type": "手作/体验",
    "sub_type": "汉服妆造/拍摄",
    "role": "core",
    "duration_min": 120,
    "duration_max": 240,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "aesthetic",
      "nostalgic",
      "creative"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "special"
  },
  {
    "id": "photography",
    "name": "摄影体验",
    "main_type": "手作/体验",
    "sub_type": "人像/街拍课",
    "role": "core",
    "duration_min": 120,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "creative",
      "aesthetic",
      "outdoors"
    ],
    "physical_demand": "medium",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "other_class",
    "name": "其他体验课",
    "main_type": "手作/体验",
    "sub_type": "手工/非遗等",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "creative"
    ],
    "physical_demand": "medium",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "karting",
    "name": "卡丁车",
    "main_type": "游戏/轻刺激",
    "sub_type": "室内/室外卡丁车",
    "role": "core",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "high_energy",
      "wild"
    ],
    "physical_demand": "high",
    "excitement": 3,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "track_open"
    ],
    "combinable": false,
    "novelty": "normal"
  },
  {
    "id": "bowling",
    "name": "保龄球",
    "main_type": "游戏/轻刺激",
    "sub_type": "保龄球",
    "role": "core",
    "duration_min": 90,
    "duration_max": 150,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "social",
      "chill"
    ],
    "physical_demand": "medium",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "billiards",
    "name": "台球",
    "main_type": "游戏/轻刺激",
    "sub_type": "台球/斯诺克",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "social",
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "archery",
    "name": "射箭",
    "main_type": "游戏/轻刺激",
    "sub_type": "反曲/复合弓",
    "role": "core",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "high_energy",
      "nerdy"
    ],
    "physical_demand": "medium",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "shooting",
    "name": "射击体验",
    "main_type": "游戏/轻刺激",
    "sub_type": "气枪/靶场",
    "role": "core",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "high_energy",
      "nerdy"
    ],
    "physical_demand": "medium",
    "excitement": 3,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": false,
    "requirements": [
      "range_license_ok"
    ],
    "combinable": true,
    "novelty": "special"
  },
  {
    "id": "climbing",
    "name": "攀岩体验",
    "main_type": "游戏/轻刺激",
    "sub_type": "室内攀岩",
    "role": "core",
    "duration_min": 90,
    "duration_max": 150,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "high_energy",
      "wild"
    ],
    "physical_demand": "high",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "wall_open"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "vr",
    "name": "VR",
    "main_type": "游戏/轻刺激",
    "sub_type": "VR体验馆",
    "role": "core",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "immersive",
      "high_energy",
      "nerdy"
    ],
    "physical_demand": "medium",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "arcade",
    "name": "电玩城",
    "main_type": "游戏/轻刺激",
    "sub_type": "街机/抓娃娃",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "high_energy",
      "social",
      "young"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "escape_room",
    "name": "密室逃脱",
    "main_type": "游戏/轻刺激",
    "sub_type": "主题密室",
    "role": "core",
    "duration_min": 120,
    "duration_max": 180,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "immersive",
      "creative",
      "nerdy"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "niche"
  },
  {
    "id": "jubensha",
    "name": "剧本杀",
    "main_type": "游戏/轻刺激",
    "sub_type": "实景/桌面剧本",
    "role": "core",
    "duration_min": 180,
    "duration_max": 300,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "immersive",
      "social",
      "creative"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": false,
    "novelty": "niche"
  },
  {
    "id": "trpg",
    "name": "跑团",
    "main_type": "游戏/轻刺激",
    "sub_type": "TRPG/桌游团",
    "role": "core",
    "duration_min": 180,
    "duration_max": 300,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nerdy",
      "immersive",
      "social"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": false,
    "requirements": [],
    "combinable": false,
    "novelty": "niche"
  },
  {
    "id": "board_game",
    "name": "桌游",
    "main_type": "游戏/轻刺激",
    "sub_type": "桌游吧",
    "role": "core",
    "duration_min": 120,
    "duration_max": 240,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "social",
      "chill",
      "creative"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "horse_riding",
    "name": "骑马体验",
    "main_type": "游戏/轻刺激",
    "sub_type": "马术/骑乘",
    "role": "core",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors",
      "high_energy"
    ],
    "physical_demand": "medium",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "public_experience_available"
    ],
    "combinable": true,
    "novelty": "special"
  },
  {
    "id": "ice_skating",
    "name": "滑冰",
    "main_type": "游戏/轻刺激",
    "sub_type": "真冰/仿真冰",
    "role": "core",
    "duration_min": 90,
    "duration_max": 150,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "high_energy"
    ],
    "physical_demand": "medium",
    "excitement": 2,
    "season": "winter",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "sim_racing",
    "name": "模拟赛车",
    "main_type": "游戏/轻刺激",
    "sub_type": "赛车模拟器",
    "role": "core",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "high_energy",
      "nerdy"
    ],
    "physical_demand": "low",
    "excitement": 3,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "sim_flight",
    "name": "模拟飞行",
    "main_type": "游戏/轻刺激",
    "sub_type": "飞行模拟器",
    "role": "core",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nerdy",
      "immersive"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": false,
    "requirements": [],
    "combinable": true,
    "novelty": "niche"
  },
  {
    "id": "pickleball",
    "name": "匹克球",
    "main_type": "游戏/轻刺激",
    "sub_type": "新兴球类",
    "role": "core",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "outdoors",
      "high_energy",
      "social"
    ],
    "physical_demand": "medium",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "niche"
  },
  {
    "id": "squash",
    "name": "壁球",
    "main_type": "游戏/轻刺激",
    "sub_type": "壁球",
    "role": "core",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "2"
    ],
    "location_scope": "urban",
    "vibe": [
      "high_energy"
    ],
    "physical_demand": "high",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "niche"
  },
  {
    "id": "mini_golf",
    "name": "迷你高尔夫",
    "main_type": "游戏/轻刺激",
    "sub_type": "室内/户外迷你高尔夫",
    "role": "core",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "outdoors",
      "chill",
      "social"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "hot_spring_bath",
    "name": "汤泉",
    "main_type": "放松",
    "sub_type": "城市汤泉",
    "role": "core",
    "duration_min": 240,
    "duration_max": 480,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "both",
    "vibe": [
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 0,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "onsen",
    "name": "温泉",
    "main_type": "放松",
    "sub_type": "温泉度假",
    "role": "core",
    "duration_min": 240,
    "duration_max": 480,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 0,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "public_bath_available"
    ],
    "combinable": true,
    "novelty": "special"
  },
  {
    "id": "sauna",
    "name": "桑拿",
    "main_type": "放松",
    "sub_type": "桑拿/汗蒸",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 0,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "spa",
    "name": "SPA",
    "main_type": "放松",
    "sub_type": "水疗护理",
    "role": "core",
    "duration_min": 120,
    "duration_max": 240,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "chill",
      "romantic"
    ],
    "physical_demand": "low",
    "excitement": 0,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "massage",
    "name": "按摩",
    "main_type": "放松",
    "sub_type": "推拿/按摩",
    "role": "core",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 0,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "afternoon_tea",
    "name": "下午茶",
    "main_type": "放松",
    "sub_type": "下午茶",
    "role": "support",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "chill",
      "romantic",
      "aesthetic"
    ],
    "physical_demand": "low",
    "excitement": 0,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "cocktail",
    "name": "鸡尾酒",
    "main_type": "放松",
    "sub_type": "小酌鸡尾酒",
    "role": "support",
    "duration_min": 60,
    "duration_max": 120,
    "suitable_people": [
      "2"
    ],
    "location_scope": "urban",
    "vibe": [
      "night",
      "social",
      "aesthetic"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "bar",
    "name": "酒吧",
    "main_type": "放松",
    "sub_type": "清吧/小酒馆",
    "role": "support",
    "duration_min": 90,
    "duration_max": 240,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "night",
      "social",
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "night_view",
    "name": "看夜景",
    "main_type": "放松",
    "sub_type": "城市夜景",
    "role": "support",
    "duration_min": 30,
    "duration_max": 90,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "romantic",
      "chill",
      "aesthetic",
      "night"
    ],
    "physical_demand": "low",
    "excitement": 0,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "sunset",
    "name": "看日落",
    "main_type": "放松",
    "sub_type": "日落观测",
    "role": "support",
    "duration_min": 30,
    "duration_max": 90,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "romantic",
      "chill",
      "aesthetic",
      "outdoors"
    ],
    "physical_demand": "low",
    "excitement": 0,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [
      "clear_weather"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "picnic",
    "name": "野餐",
    "main_type": "放松",
    "sub_type": "公园野餐",
    "role": "support",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "both",
    "vibe": [
      "outdoors",
      "chill",
      "romantic"
    ],
    "physical_demand": "low",
    "excitement": 0,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [
      "park_open"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "hiking",
    "name": "徒步",
    "main_type": "自然/户外",
    "sub_type": "近郊徒步",
    "role": "core",
    "duration_min": 120,
    "duration_max": 360,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors",
      "chill"
    ],
    "physical_demand": "medium",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [
      "trail_open"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "mountain",
    "name": "爬山",
    "main_type": "自然/户外",
    "sub_type": "登山",
    "role": "core",
    "duration_min": 240,
    "duration_max": 480,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors",
      "high_energy"
    ],
    "physical_demand": "high",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [
      "trail_open"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "cycling",
    "name": "骑行",
    "main_type": "自然/户外",
    "sub_type": "绿道/公路骑行",
    "role": "core",
    "duration_min": 90,
    "duration_max": 240,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "both",
    "vibe": [
      "outdoors"
    ],
    "physical_demand": "medium",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "camping",
    "name": "露营",
    "main_type": "自然/户外",
    "sub_type": "营地露营",
    "role": "core",
    "duration_min": 360,
    "duration_max": 1440,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors",
      "chill"
    ],
    "physical_demand": "medium",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "camping_allowed"
    ],
    "combinable": false,
    "novelty": "normal"
  },
  {
    "id": "overnight_camp",
    "name": "野营过夜",
    "main_type": "自然/户外",
    "sub_type": "过夜露营",
    "role": "core",
    "duration_min": 360,
    "duration_max": 2880,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors"
    ],
    "physical_demand": "medium",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "camping_allowed",
      "overnight_allowed"
    ],
    "combinable": false,
    "novelty": "special"
  },
  {
    "id": "fishing",
    "name": "钓鱼",
    "main_type": "自然/户外",
    "sub_type": "休闲垂钓",
    "role": "core",
    "duration_min": 120,
    "duration_max": 360,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors",
      "chill",
      "nerdy"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [
      "fishing_allowed"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "boating",
    "name": "划船",
    "main_type": "自然/户外",
    "sub_type": "游船/划艇",
    "role": "core",
    "duration_min": 60,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors",
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "boat_rental_available"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "rafting",
    "name": "漂流",
    "main_type": "自然/户外",
    "sub_type": "峡谷/河道漂流",
    "role": "core",
    "duration_min": 120,
    "duration_max": 240,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors",
      "high_energy",
      "wild"
    ],
    "physical_demand": "high",
    "excitement": 3,
    "season": "summer",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "season_open"
    ],
    "combinable": false,
    "novelty": "special"
  },
  {
    "id": "picking",
    "name": "采摘",
    "main_type": "自然/户外",
    "sub_type": "果园/农场采摘",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors",
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "autumn",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [
      "season_open",
      "farm_open"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "sup",
    "name": "桨板",
    "main_type": "自然/户外",
    "sub_type": "SUP桨板",
    "role": "core",
    "duration_min": 60,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors",
      "high_energy"
    ],
    "physical_demand": "medium",
    "excitement": 2,
    "season": "summer",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "water_open",
      "rental_available"
    ],
    "combinable": true,
    "novelty": "niche"
  },
  {
    "id": "water_sports",
    "name": "水上运动",
    "main_type": "自然/户外",
    "sub_type": "摩托艇/帆板等",
    "role": "core",
    "duration_min": 90,
    "duration_max": 240,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors",
      "high_energy",
      "wild"
    ],
    "physical_demand": "high",
    "excitement": 3,
    "season": "summer",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "water_open",
      "rental_available"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "sunrise",
    "name": "看日出",
    "main_type": "自然/户外",
    "sub_type": "日出观测",
    "role": "core",
    "duration_min": 30,
    "duration_max": 90,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors",
      "romantic",
      "chill"
    ],
    "physical_demand": "medium",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [
      "clear_weather"
    ],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "stargazing",
    "name": "观星",
    "main_type": "自然/户外",
    "sub_type": "天文观测",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "outdoors",
      "nerdy",
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [
      "clear_weather",
      "low_light_pollution"
    ],
    "combinable": true,
    "novelty": "niche"
  },
  {
    "id": "amusement_park",
    "name": "游乐园",
    "main_type": "乐园/大型目的地",
    "sub_type": "机动游乐园",
    "role": "core",
    "duration_min": 360,
    "duration_max": 720,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "high_energy",
      "social",
      "young"
    ],
    "physical_demand": "high",
    "excitement": 3,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": false,
    "novelty": "normal"
  },
  {
    "id": "theme_park",
    "name": "主题公园",
    "main_type": "乐园/大型目的地",
    "sub_type": "IP主题公园",
    "role": "core",
    "duration_min": 360,
    "duration_max": 720,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "high_energy",
      "social",
      "young",
      "immersive"
    ],
    "physical_demand": "high",
    "excitement": 3,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": false,
    "novelty": "normal"
  },
  {
    "id": "large_resort",
    "name": "大型乐园",
    "main_type": "乐园/大型目的地",
    "sub_type": "综合度假区",
    "role": "core",
    "duration_min": 480,
    "duration_max": 960,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "high_energy",
      "social"
    ],
    "physical_demand": "high",
    "excitement": 3,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": false,
    "novelty": "special"
  },
  {
    "id": "water_park",
    "name": "水上乐园",
    "main_type": "乐园/大型目的地",
    "sub_type": "水上乐园",
    "role": "core",
    "duration_min": 240,
    "duration_max": 480,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "outdoors",
      "high_energy"
    ],
    "physical_demand": "medium",
    "excitement": 3,
    "season": "summer",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": false,
    "novelty": "normal"
  },
  {
    "id": "botanical_garden",
    "name": "大型园区/植物园",
    "main_type": "乐园/大型目的地",
    "sub_type": "植物园/大园区",
    "role": "core",
    "duration_min": 120,
    "duration_max": 300,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "both",
    "vibe": [
      "outdoors",
      "chill",
      "aesthetic"
    ],
    "physical_demand": "low",
    "excitement": 0,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "zoo",
    "name": "动物园",
    "main_type": "乐园/大型目的地",
    "sub_type": "动物园",
    "role": "core",
    "duration_min": 120,
    "duration_max": 300,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "outdoors",
      "chill",
      "young"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "quirky_museum",
    "name": "奇趣博物馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "脑洞/怪奇博物馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nerdy",
      "weird",
      "aesthetic"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "weird"
  },
  {
    "id": "art_museum",
    "name": "艺术博物馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "艺术类博物馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "aesthetic",
      "nerdy"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "history_museum",
    "name": "历史博物馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "历史类博物馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nostalgic",
      "nerdy"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "science_museum",
    "name": "科技博物馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "科技类博物馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nerdy",
      "young"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "nature_museum",
    "name": "自然博物馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "自然类博物馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nerdy",
      "young"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "military_museum",
    "name": "军事博物馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "军事类博物馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nerdy"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "car_museum",
    "name": "汽车博物馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "汽车类博物馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nerdy"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "industry_museum",
    "name": "工业博物馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "工业类博物馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nerdy",
      "nostalgic"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "food_museum",
    "name": "食物博物馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "食物类博物馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 150,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nerdy",
      "weird"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "niche"
  },
  {
    "id": "folk_museum",
    "name": "民俗博物馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "民俗类博物馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nostalgic",
      "nerdy"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "obscure_museum",
    "name": "冷门博物馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "冷门类博物馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 150,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nerdy",
      "weird"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "niche"
  },
  {
    "id": "general_museum",
    "name": "普通主题博物馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "综合类博物馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "nerdy",
      "aesthetic"
    ],
    "physical_demand": "low",
    "excitement": 0,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "art_gallery",
    "name": "美术馆",
    "main_type": "文化/奇趣探索",
    "sub_type": "当代美术馆",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "aesthetic",
      "creative"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "niche_exhibition",
    "name": "小众展览",
    "main_type": "文化/奇趣探索",
    "sub_type": "独立/小众展览",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "aesthetic",
      "nerdy",
      "creative"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "niche"
  },
  {
    "id": "cultural_space",
    "name": "特色文化空间",
    "main_type": "文化/奇趣探索",
    "sub_type": "文创/复合空间",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "creative",
      "aesthetic",
      "social"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "special"
  },
  {
    "id": "weird_exhibition",
    "name": "奇怪的主题展览",
    "main_type": "文化/奇趣探索",
    "sub_type": "怪奇主题展",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "weird",
      "creative",
      "aesthetic"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "weird"
  },
  {
    "id": "city_walk",
    "name": "City Walk",
    "main_type": "城市探索",
    "sub_type": "城市漫步",
    "role": "core",
    "duration_min": 90,
    "duration_max": 240,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "chill",
      "aesthetic",
      "social"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "hutong_night",
    "name": "胡同夜游",
    "main_type": "城市探索",
    "sub_type": "胡同夜游",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "night",
      "aesthetic",
      "nostalgic"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "old_architecture",
    "name": "老建筑探索",
    "main_type": "城市探索",
    "sub_type": "老建筑/名人故居",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "aesthetic",
      "nostalgic",
      "nerdy"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "neighborhood",
    "name": "街区探索",
    "main_type": "城市探索",
    "sub_type": "街区漫游",
    "role": "core",
    "duration_min": 60,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "chill",
      "aesthetic",
      "social"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "night_route",
    "name": "夜游路线",
    "main_type": "城市探索",
    "sub_type": "夜间city walk",
    "role": "core",
    "duration_min": 90,
    "duration_max": 180,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "night",
      "aesthetic",
      "social"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "random_district",
    "name": "随机城区探索",
    "main_type": "城市探索",
    "sub_type": "随机城区漫游",
    "role": "core",
    "duration_min": 120,
    "duration_max": 300,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "chill",
      "weird",
      "social"
    ],
    "physical_demand": "low",
    "excitement": 1,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "niche"
  },
  {
    "id": "walk",
    "name": "散步",
    "main_type": "城市探索",
    "sub_type": "街区短路线",
    "role": "support",
    "duration_min": 30,
    "duration_max": 90,
    "suitable_people": [
      "1",
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "chill"
    ],
    "physical_demand": "low",
    "excitement": 0,
    "season": "all_year",
    "reservation_required": false,
    "first_time_friendly": true,
    "requirements": [],
    "combinable": true,
    "novelty": "normal"
  },
  {
    "id": "racing_watch",
    "name": "赛车观赛",
    "main_type": "赛事/观赏",
    "sub_type": "赛车现场",
    "role": "core",
    "duration_min": 120,
    "duration_max": 240,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "high_energy"
    ],
    "physical_demand": "low",
    "excitement": 3,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "event_scheduled"
    ],
    "combinable": false,
    "novelty": "normal"
  },
  {
    "id": "equestrian_watch",
    "name": "马术观赛",
    "main_type": "赛事/观赏",
    "sub_type": "马术比赛",
    "role": "core",
    "duration_min": 120,
    "duration_max": 240,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "suburban",
    "vibe": [
      "aesthetic",
      "high_energy"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "event_scheduled"
    ],
    "combinable": false,
    "novelty": "special"
  },
  {
    "id": "figure_skating_watch",
    "name": "花滑观赛",
    "main_type": "赛事/观赏",
    "sub_type": "花样滑冰赛",
    "role": "core",
    "duration_min": 120,
    "duration_max": 180,
    "suitable_people": [
      "2"
    ],
    "location_scope": "urban",
    "vibe": [
      "aesthetic",
      "high_energy"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "winter",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "event_scheduled"
    ],
    "combinable": false,
    "novelty": "special"
  },
  {
    "id": "esports_watch",
    "name": "电竞观赛",
    "main_type": "赛事/观赏",
    "sub_type": "电竞赛事",
    "role": "core",
    "duration_min": 120,
    "duration_max": 240,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "urban",
    "vibe": [
      "high_energy",
      "social",
      "nerdy"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "event_scheduled"
    ],
    "combinable": false,
    "novelty": "normal"
  },
  {
    "id": "live_sport_other",
    "name": "其他低门槛现场赛事",
    "main_type": "赛事/观赏",
    "sub_type": "球类/小众赛事",
    "role": "core",
    "duration_min": 120,
    "duration_max": 240,
    "suitable_people": [
      "2",
      "3+"
    ],
    "location_scope": "both",
    "vibe": [
      "high_energy",
      "social"
    ],
    "physical_demand": "low",
    "excitement": 2,
    "season": "all_year",
    "reservation_required": true,
    "first_time_friendly": true,
    "requirements": [
      "event_scheduled"
    ],
    "combinable": false,
    "novelty": "normal"
  }];
