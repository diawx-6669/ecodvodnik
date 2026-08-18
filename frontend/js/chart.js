// Простое текстовое отображение тренда без подключения тяжёлых библиотек графиков.
// При желании легко заменить на Chart.js/Recharts — просто рендерить в элемент с id="*-trend".

function formatTrend(percent) {
  if (percent === undefined || percent === null) return '—';
  const arrow = percent > 0 ? '▲' : percent < 0 ? '▼' : '→';
  const sign = percent > 0 ? '+' : '';
  const cls = percent > 0 ? 'trend-up' : percent < 0 ? 'trend-down' : '';
  return { text: `${arrow} ${sign}${percent}% к прошлой неделе`, cls };
}
