/** 静态地点测试数据：真实场馆/公共空间，不是实时活动；updated_at 为人工核验日期。 */
export const placeCategories = ["餐饮", "咖啡", "酒吧", "展览", "博物馆", "剧场", "Live House", "手作", "运动", "桌游", "密室", "户外", "其他"];

export const places = [
  { id: "beijing-planetarium", name: "北京天文馆", category: "博物馆", latitude: 39.9438, longitude: 116.3317, address: "北京市西城区西直门外大街138号", suitable_for_people: ["一个人", "两个人", "一群人"], suitable_duration: ["2-3小时", "半天"], source: "北京天文馆官网", source_url: "https://www.bjp.org.cn/", updated_at: "2025-01-01" },
  { id: "summer-palace", name: "颐和园", category: "户外", latitude: 40.0010, longitude: 116.2755, address: "北京市海淀区新建宫门路19号", suitable_for_people: ["一个人", "两个人", "一群人"], suitable_duration: ["半天", "一整天"], source: "颐和园官方网站", source_url: "https://www.summerpalace-china.com/", updated_at: "2025-01-01" },
  { id: "china-science-technology-museum", name: "中国科学技术馆", category: "博物馆", latitude: 40.0024, longitude: 116.3971, address: "北京市朝阳区北辰东路5号", suitable_for_people: ["一个人", "两个人", "一群人"], suitable_duration: ["半天", "一整天"], source: "中国科学技术馆官网", source_url: "https://www.cstm.org.cn/", updated_at: "2025-01-01" },
  { id: "olympic-forest-park", name: "奥林匹克森林公园", category: "户外", latitude: 40.0182, longitude: 116.3931, address: "北京市朝阳区北辰东路15号", suitable_for_people: ["一个人", "两个人", "一群人"], suitable_duration: ["2-3小时", "半天", "一整天"], source: "北京奥林匹克森林公园", source_url: "https://www.bjofpark.com/", updated_at: "2025-01-01" },
  { id: "nanluoguxiang-area", name: "南锣鼓巷历史文化街区", category: "户外", latitude: 39.9342, longitude: 116.4037, address: "北京市东城区南锣鼓巷", suitable_for_people: ["一个人", "两个人", "一群人"], suitable_duration: ["2-3小时", "半天"], source: "东城区政府公开信息", source_url: "https://www.bjdch.gov.cn/", updated_at: "2025-01-01" },
];
