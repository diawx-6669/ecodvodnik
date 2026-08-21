/**
 * Определяет "настроение", уровень и стадию эволюции питомца на основе
 * сводки потребления.
 * mood: 'happy' | 'neutral' | 'surprised' | 'worried' | 'tired' | 'sad' | 'angry' | 'sick'
 * stage: 'seed' | 'sprout' | 'sapling' | 'tree' | 'bloom' — растёт вместе с уровнем (1-10)
 */

// Стадии эволюции питомца по уровню — чем больше пользователь экономит,
// тем "взрослее" выглядит питомец.
const STAGE_BY_LEVEL = (level) => {
  if (level >= 9) return 'bloom';
  if (level >= 7) return 'tree';
  if (level >= 5) return 'sapling';
  if (level >= 3) return 'sprout';
  return 'seed';
};

const STAGE_LABELS = {
  seed: 'семечко',
  sprout: 'росток',
  sapling: 'деревце',
  tree: 'дерево',
  bloom: 'цветение',
};

function computePetState(summary, options = {}) {
  const { lastReadingTimestamp = null } = options;

  const worstTrend = Math.max(
    summary.water.trend_percent || 0,
    summary.electricity.trend_percent || 0
  );
  const anomalyCount = summary.anomalies.length;

  // "Устал" — если давно не было новых показаний (питомец скучает по
  // вниманию), это не зависит от самого расхода.
  const hoursSinceLastReading = lastReadingTimestamp
    ? (Date.now() - new Date(lastReadingTimestamp).getTime()) / (1000 * 60 * 60)
    : null;
  const isTired = hoursSinceLastReading !== null && hoursSinceLastReading > 48;

  let mood = 'neutral';
  if (anomalyCount >= 3 || worstTrend > 70) {
    // Совсем плохо — питомец буквально "заболел" от перерасхода
    mood = 'sick';
  } else if (anomalyCount >= 2 || worstTrend > 40) {
    mood = 'angry';
  } else if (anomalyCount === 1) {
    mood = 'sad';
  } else if (isTired) {
    mood = 'tired';
  } else if (worstTrend > 25 && worstTrend <= 40) {
    mood = 'worried';
  } else if (worstTrend > 10 && worstTrend <= 25) {
    // Небольшой неожиданный скачок расхода без явной аномалии — питомец
    // удивлён, но ещё не встревожен всерьёз.
    mood = 'surprised';
  } else if (worstTrend <= -10) {
    mood = 'happy';
  }

  // Уровень растёт, когда фактическое потребление НИЖЕ норматива (пользователь
  // экономит), и падает, когда потребление выше нормы.
  const benchmark = summary.benchmark || {};
  const avgVsBenchmarkPercent =
    ((benchmark.water_vs_benchmark_percent || 0) + (benchmark.electricity_vs_benchmark_percent || 0)) / 2;
  const level = Math.max(1, Math.min(10, Math.round(5 - avgVsBenchmarkPercent / 20)));
  const xp = Math.max(0, Math.min(100, Math.round(50 - avgVsBenchmarkPercent)));
  const stage = STAGE_BY_LEVEL(level);

  return { mood, level, xp, stage, stageLabel: STAGE_LABELS[stage], worstTrend, isTired };
}

module.exports = { computePetState, STAGE_BY_LEVEL, STAGE_LABELS };
