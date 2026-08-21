/**
 * Определяет "настроение" и уровень питомца на основе сводки потребления.
 * mood: 'happy' | 'neutral' | 'worried' | 'sad' | 'angry'
 */
function computePetState(summary) {
  const worstTrend = Math.max(
    summary.water.trend_percent || 0,
    summary.electricity.trend_percent || 0
  );

  let mood = 'neutral';
  // Питомец злится, когда ситуация действительно плохая: несколько аномалий
  // сразу или резкий рост расхода. Тогда он краснеет и отворачивается.
  if (summary.anomalies.length >= 2 || worstTrend > 40) {
    mood = 'angry';
  } else if (summary.anomalies.length > 0) {
    mood = 'sad';
  } else if (worstTrend <= -10) {
    mood = 'happy';
  } else if (worstTrend > 10 && worstTrend <= 25) {
    mood = 'worried';
  }

  // Уровень растёт, когда фактическое потребление НИЖЕ норматива (пользователь
  // экономит), и падает, когда потребление выше нормы. Раньше здесь по ошибке
  // использовалась total_cost_kzt (сумма трат), из-за чего уровень питомца
  // рос вместе с расходами — то есть чем больше тратишь, тем "лучше" питомцу,
  // что прямо противоречило идее продукта.
  const benchmark = summary.benchmark || {};
  const avgVsBenchmarkPercent =
    ((benchmark.water_vs_benchmark_percent || 0) + (benchmark.electricity_vs_benchmark_percent || 0)) / 2;
  // avgVsBenchmarkPercent отрицательный => расход ниже нормы => экономия => выше уровень
  const level = Math.max(1, Math.min(10, Math.round(5 - avgVsBenchmarkPercent / 20)));

  return { mood, level, worstTrend };
}

module.exports = { computePetState };
