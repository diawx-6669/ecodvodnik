/**
 * Определяет "настроение" и уровень питомца на основе сводки потребления.
 * mood: 'happy' | 'neutral' | 'worried' | 'sad'
 */
function computePetState(summary) {
  const worstTrend = Math.max(
    summary.water.trend_percent || 0,
    summary.electricity.trend_percent || 0
  );

  let mood = 'neutral';
  if (summary.anomalies.length > 0) {
    mood = 'sad';
  } else if (worstTrend <= -10) {
    mood = 'happy';
  } else if (worstTrend > 10 && worstTrend <= 25) {
    mood = 'worried';
  }

  // Простая система уровней: чем больше "хороших" недель, тем выше уровень.
  // Для MVP считаем на основе экономии — чем больше сэкономлено, тем выше уровень.
  const level = Math.max(1, Math.min(10, Math.floor(summary.total_cost_kzt / 5000) + 1));

  return { mood, level, worstTrend };
}

module.exports = { computePetState };
