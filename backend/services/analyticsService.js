const config = require('../config/config');

/**
 * Считает суммарное потребление по типу за последние N дней.
 */
function sumByType(readings, type, days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return readings
    .filter((r) => r.type === type && new Date(r.timestamp).getTime() >= cutoff)
    .reduce((acc, r) => acc + r.value, 0);
}

/**
 * Сравнивает текущий период с предыдущим и считает динамику в процентах.
 */
function trendPercent(readings, type, days = 7) {
  const now = Date.now();
  const currentStart = now - days * 24 * 60 * 60 * 1000;
  const prevStart = now - 2 * days * 24 * 60 * 60 * 1000;

  const current = readings
    .filter((r) => r.type === type && new Date(r.timestamp).getTime() >= currentStart)
    .reduce((acc, r) => acc + r.value, 0);

  const previous = readings
    .filter(
      (r) =>
        r.type === type &&
        new Date(r.timestamp).getTime() >= prevStart &&
        new Date(r.timestamp).getTime() < currentStart
    )
    .reduce((acc, r) => acc + r.value, 0);

  if (previous === 0) return { current, previous, changePercent: 0 };

  const changePercent = ((current - previous) / previous) * 100;
  return { current, previous, changePercent: Math.round(changePercent * 10) / 10 };
}

/**
 * Переводит потребление в деньги (KZT) по тарифам.
 */
function toMoney(type, value) {
  if (type === 'water') return value * config.tariffs.water_kzt_per_liter;
  if (type === 'electricity') return value * config.tariffs.electricity_kzt_per_kwh;
  return 0;
}

/**
 * Сравнивает фактическое потребление за 7 дней с нормативом для типа
 * аудитории пользователя (дом/школа/бизнес), умноженным на его "размер"
 * (человек в семье / учеников / сотрудников).
 */
function buildBenchmarkComparison(user, waterWeekTotal, electricityWeekTotal) {
  const type = user && user.type && config.benchmarks[user.type] ? user.type : 'household';
  const bench = config.benchmarks[type];
  const units = user && user.unitsCount ? user.unitsCount : 1;

  const expectedWaterWeek = bench.water_liters_per_unit_per_day * units * 7;
  const expectedElectricityWeek = bench.electricity_kwh_per_unit_per_day * units * 7;

  const waterVsBenchmarkPercent = expectedWaterWeek
    ? Math.round(((waterWeekTotal - expectedWaterWeek) / expectedWaterWeek) * 1000) / 10
    : 0;
  const electricityVsBenchmarkPercent = expectedElectricityWeek
    ? Math.round(((electricityWeekTotal - expectedElectricityWeek) / expectedElectricityWeek) * 1000) / 10
    : 0;

  return {
    audience_type: type,
    audience_label: bench.label,
    units,
    expected_water_liters: Math.round(expectedWaterWeek),
    expected_electricity_kwh: Math.round(expectedElectricityWeek * 10) / 10,
    water_vs_benchmark_percent: waterVsBenchmarkPercent,
    electricity_vs_benchmark_percent: electricityVsBenchmarkPercent,
  };
}

/**
 * Собирает полную сводку для дашборда и питомца.
 * user (необязательно) — используется для персонального норматива
 * (жилой дом / школа / малый бизнес) и его размера.
 */
function buildSummary(readings, user = null) {
  const water7d = sumByType(readings, 'water', 7);
  const electricity7d = sumByType(readings, 'electricity', 7);

  const waterTrend = trendPercent(readings, 'water', 7);
  const electricityTrend = trendPercent(readings, 'electricity', 7);

  const waterCost = water7d * config.tariffs.water_kzt_per_liter;
  const electricityCost = electricity7d * config.tariffs.electricity_kzt_per_kwh;

  const benchmark = buildBenchmarkComparison(user, water7d, electricity7d);

  // Простая эвристика аномалии: рост более чем на 25% к прошлой неделе,
  // либо расход значительно выше норматива для типа аудитории пользователя.
  const anomalies = [];
  if (waterTrend.changePercent > 25) {
    anomalies.push({
      type: 'water',
      message: 'Резкий рост расхода воды — возможна утечка.',
      changePercent: waterTrend.changePercent,
    });
  }
  if (electricityTrend.changePercent > 25) {
    anomalies.push({
      type: 'electricity',
      message: 'Резкий рост расхода электроэнергии — проверьте приборы.',
      changePercent: electricityTrend.changePercent,
    });
  }
  if (benchmark.water_vs_benchmark_percent > 40) {
    anomalies.push({
      type: 'water',
      message: `Расход воды выше нормы (${benchmark.audience_label}) на ${benchmark.water_vs_benchmark_percent}%.`,
      changePercent: benchmark.water_vs_benchmark_percent,
    });
  }
  if (benchmark.electricity_vs_benchmark_percent > 40) {
    anomalies.push({
      type: 'electricity',
      message: `Расход электричества выше нормы (${benchmark.audience_label}) на ${benchmark.electricity_vs_benchmark_percent}%.`,
      changePercent: benchmark.electricity_vs_benchmark_percent,
    });
  }

  return {
    period_days: 7,
    water: {
      total_liters: Math.round(water7d),
      cost_kzt: Math.round(waterCost),
      trend_percent: waterTrend.changePercent,
    },
    electricity: {
      total_kwh: Math.round(electricity7d * 10) / 10,
      cost_kzt: Math.round(electricityCost),
      trend_percent: electricityTrend.changePercent,
    },
    total_cost_kzt: Math.round(waterCost + electricityCost),
    anomalies,
    benchmark,
  };
}

module.exports = { sumByType, trendPercent, toMoney, buildSummary, buildBenchmarkComparison };
