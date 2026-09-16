const DAY = 24 * 60 * 60 * 1000;

export function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }
export function pickDestination(lines) { const line = randomItem(lines); return { line, station: randomItem(line.stations) }; }

export function distanceKm(a, b) {
  const rad = (value) => (value * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude); const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
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
function radiusFor(duration) { return { "2-3小时": 2, "半天": 5, "一整天": 12 }[duration]; }

/** 真地点 -> 人数 -> 时长 -> 去掉已结束活动 -> 距离/新鲜度排序 -> 从优先候选池随机抽取。 */
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
