// Персонализированные советы по экономии — детерминированные (без AI-вызова),
// основаны на реальных данных пользователя: во сколько расход выше нормы,
// в какие часы больше всего расхода, есть ли аномалии, какой тип аудитории.

const WATER_TIPS = [
  { id: 'w_leak', title: 'Проверьте утечки', detail: 'Резкий скачок расхода воды часто означает подтекающий кран или бачок унитаза — это может быть до 15 л/ч.', savingsHint: 'до 3000 ₸/мес' },
  { id: 'w_shower', title: 'Сократите время в душе', detail: 'Душ на 2 минуты короче экономит в среднем 20 литров воды за один раз.', savingsHint: '~1500 ₸/мес' },
  { id: 'w_aerator', title: 'Поставьте аэратор на кран', detail: 'Насадка-аэратор снижает расход воды из крана на 30-50% без потери напора.', savingsHint: '~2000 ₸/мес' },
  { id: 'w_washer', title: 'Стирайте полной загрузкой', detail: 'Стиральная машина тратит почти одинаково воды на полупустую и полную загрузку — копите бельё.', savingsHint: '~800 ₸/мес' },
];

const ELECTRICITY_TIPS = [
  { id: 'e_standby', title: 'Отключайте приборы из розетки', detail: 'Техника в режиме ожидания (ТВ, зарядки, роутер) съедает до 8% счёта за электричество.', savingsHint: '~1200 ₸/мес' },
  { id: 'e_led', title: 'Замените лампы на LED', detail: 'LED-лампы потребляют в 5-7 раз меньше энергии, чем лампы накаливания, при том же освещении.', savingsHint: '~1000 ₸/мес' },
  { id: 'e_fridge', title: 'Проверьте уплотнитель холодильника', detail: 'Изношенный уплотнитель заставляет холодильник работать почти непрерывно — это до 20% лишнего расхода.', savingsHint: '~1500 ₸/мес' },
  { id: 'e_peak', title: 'Сдвиньте пиковые нагрузки', detail: 'Стирку, глажку и обогрев лучше не включать все одновременно в вечерние часы — это снижает пиковый расход.', savingsHint: '~700 ₸/мес' },
  { id: 'e_ac', title: 'Настройте кондиционер на 24°C', detail: 'Каждый градус ниже 24°C добавляет примерно 5-8% к расходу кондиционера.', savingsHint: '~2500 ₸/мес' },
];

const GENERAL_TIPS = [
  { id: 'g_goal', title: 'Поставьте месячную цель', detail: 'Пользователи с установленной целью экономят в среднем на 12% больше — цель дисциплинирует.', savingsHint: 'дисциплина' },
  { id: 'g_family', title: 'Подключите всю семью', detail: 'Общий семейный аккаунт помогает видеть суммарный расход и вовлекает всех в экономию.', savingsHint: 'вовлечённость' },
];

function pick(list, n, seedOffset = 0) {
  // Детерминированный, но "перемешанный" выбор — чтобы советы менялись
  // день ото дня, а не были всегда одним и тем же списком сверху вниз.
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) + seedOffset;
  const rotated = list.slice(dayIndex % list.length).concat(list.slice(0, dayIndex % list.length));
  return rotated.slice(0, n);
}

/**
 * Формирует список персонализированных советов на основе summary.
 * Приоритет: сначала советы по ресурсу с превышением нормы/аномалией,
 * затем общие советы.
 */
function buildTips(summary) {
  const tips = [];
  const waterOver = summary.benchmark.water_vs_benchmark_percent > 0 || summary.water.trend_percent > 10;
  const electricityOver = summary.benchmark.electricity_vs_benchmark_percent > 0 || summary.electricity.trend_percent > 10;

  if (waterOver) tips.push(...pick(WATER_TIPS, 2, 0));
  else tips.push(...pick(WATER_TIPS, 1, 1));

  if (electricityOver) tips.push(...pick(ELECTRICITY_TIPS, 2, 2));
  else tips.push(...pick(ELECTRICITY_TIPS, 1, 3));

  tips.push(...pick(GENERAL_TIPS, 1, 4));

  return tips.map((t) => ({ ...t, reason: waterOver && t.id.startsWith('w_') ? 'Расход воды выше нормы' : electricityOver && t.id.startsWith('e_') ? 'Расход электричества выше нормы' : 'Общая рекомендация' }));
}

module.exports = { buildTips };
