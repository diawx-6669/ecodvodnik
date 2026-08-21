// Агрегирует показания в бакеты по дням/неделям/месяцам для дашборда
// «История и графики». Возвращает данные отдельно по воде и электричеству,
// готовые для отрисовки графика на фронтенде (без внешних библиотек).

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function bucketKey(date, granularity) {
  const d = new Date(date);
  if (granularity === 'day') {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  if (granularity === 'week') {
    return isoWeekKey(d);
  }
  // month
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function bucketLabel(key, granularity) {
  if (granularity === 'day') {
    const d = new Date(key);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  }
  if (granularity === 'week') {
    return key.replace(/^\d{4}-/, 'нед. ');
  }
  const [year, month] = key.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
}

/**
 * period: 'day' (последние 14 дней, бакеты по дням),
 *         'week' (последние 8 недель, бакеты по неделям),
 *         'month' (последние 12 месяцев, бакеты по месяцам)
 */
const PERIOD_CONFIG = {
  day: { granularity: 'day', spanMs: 14 * 24 * 60 * 60 * 1000, buckets: 14 },
  week: { granularity: 'week', spanMs: 8 * 7 * 24 * 60 * 60 * 1000, buckets: 8 },
  month: { granularity: 'month', spanMs: 12 * 31 * 24 * 60 * 60 * 1000, buckets: 12 },
};

function buildHistory(readings, period = 'day') {
  const cfg = PERIOD_CONFIG[period] || PERIOD_CONFIG.day;
  const cutoff = Date.now() - cfg.spanMs;
  const relevant = readings.filter((r) => new Date(r.timestamp).getTime() >= cutoff);

  const waterBuckets = new Map();
  const electricityBuckets = new Map();

  relevant.forEach((r) => {
    const key = bucketKey(r.timestamp, cfg.granularity);
    const map = r.type === 'water' ? waterBuckets : r.type === 'electricity' ? electricityBuckets : null;
    if (!map) return;
    map.set(key, (map.get(key) || 0) + r.value);
  });

  // Строим упорядоченный список ключей за нужный диапазон, даже если
  // в каких-то бакетах нет данных (чтобы график не "скакал").
  const keys = [];
  const cursor = startOfDay(new Date(cutoff));
  const now = new Date();
  const stepMs = cfg.granularity === 'day' ? 24 * 60 * 60 * 1000 : cfg.granularity === 'week' ? 7 * 24 * 60 * 60 * 1000 : null;

  if (stepMs) {
    for (let t = cursor.getTime(); t <= now.getTime(); t += stepMs) {
      const key = bucketKey(new Date(t), cfg.granularity);
      if (!keys.includes(key)) keys.push(key);
    }
  } else {
    // month
    const start = new Date(now.getFullYear(), now.getMonth() - (cfg.buckets - 1), 1);
    for (let i = 0; i < cfg.buckets; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      keys.push(bucketKey(d, 'month'));
    }
  }

  const trimmedKeys = keys.slice(-cfg.buckets);

  return {
    period,
    labels: trimmedKeys.map((k) => bucketLabel(k, cfg.granularity)),
    water: trimmedKeys.map((k) => Math.round((waterBuckets.get(k) || 0) * 10) / 10),
    electricity: trimmedKeys.map((k) => Math.round((electricityBuckets.get(k) || 0) * 10) / 10),
  };
}

module.exports = { buildHistory };
