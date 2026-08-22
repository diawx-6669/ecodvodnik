// Простое текстовое отображение тренда без подключения тяжёлых библиотек графиков.
// При желании легко заменить на Chart.js/Recharts — просто рендерить в элемент с id="*-trend".

function formatTrend(percent) {
  if (percent === undefined || percent === null) return { text: '—', cls: '' };
  const sign = percent > 0 ? '+' : '';
  const cls = percent > 0 ? 'trend-up' : percent < 0 ? 'trend-down' : 'trend-flat';
  const direction = percent > 0 ? 'рост' : percent < 0 ? 'снижение' : 'без изменений';
  return { text: `${direction}: ${sign}${percent}% к прошлой неделе`, cls };
}
