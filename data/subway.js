/** 可替换的地铁数据入口；后续可用开放数据的完整 JSON 替换，保持字段不变。 */
export const subwayLines = [
  { id: "bj-6", name: "6号线", source: "北京地铁公开线路信息（测试子集）", source_url: "https://www.bjsubway.com/", stations: [
    { id: "bj-6-chaoyangmen", name: "朝阳门", order: 1, latitude: 39.9232, longitude: 116.4415 },
    { id: "bj-6-jintailu", name: "金台路", order: 2, latitude: 39.9093, longitude: 116.4851 },
    { id: "bj-6-qingnianlu", name: "青年路", order: 3, latitude: 39.9234, longitude: 116.5171 },
  ] },
  { id: "bj-8", name: "8号线", source: "北京地铁公开线路信息（测试子集）", source_url: "https://www.bjsubway.com/", stations: [
    { id: "bj-8-nanluoguxiang", name: "南锣鼓巷", order: 1, latitude: 39.9330, longitude: 116.4039 },
    { id: "bj-8-olympic-park", name: "奥林匹克公园", order: 2, latitude: 40.0010, longitude: 116.3944 },
    { id: "bj-8-forest-park-south", name: "森林公园南门", order: 3, latitude: 40.0161, longitude: 116.3921 },
  ] },
  { id: "bj-4", name: "4号线", source: "北京地铁公开线路信息（测试子集）", source_url: "https://www.bjsubway.com/", stations: [
    { id: "bj-4-zoo", name: "动物园", order: 1, latitude: 39.9430, longitude: 116.3320 },
    { id: "bj-4-national-library", name: "国家图书馆", order: 2, latitude: 39.9430, longitude: 116.3250 },
    { id: "bj-4-beigongmen", name: "北宫门", order: 3, latitude: 40.0083, longitude: 116.2713 },
  ] },
];
