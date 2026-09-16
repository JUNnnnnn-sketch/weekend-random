/** 数据导入契约。后续无论来自 OSM、政府开放平台或人工校验，都应先映射为这些字段。 */
export const placeRequiredFields = [
  "id", "name", "category", "latitude", "longitude", "address",
  "suitable_for_people", "suitable_duration", "source", "source_url", "updated_at",
];

export const activityRequiredFields = [
  ...placeRequiredFields,
  "start_date",
  "end_date",
];

export const supportedPeople = ["一个人", "两个人", "一群人"];
export const supportedDurations = ["2-3小时", "半天", "一整天"];
