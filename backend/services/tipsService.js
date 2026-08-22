// Персонализированные советы по экономии — детерминированные (без AI-вызова),
// основаны на реальных данных пользователя: во сколько расход выше нормы,
// в какие часы больше всего расхода, есть ли аномалии, какой тип аудитории.
//
// У каждого совета есть поле audiences — список типов аккаунта, для которых
// он актуален ('household' | 'school' | 'business'). Советы про бытовые приборы
// (стиральная машина, душ, ТВ дома) относятся только к домашним аккаунтам,
// чтобы в школы и на предприятия они не попадали.

const ALL_AUDIENCES = ['household', 'school', 'business'];

const WATER_TIPS = [
  { id: 'w_leak', title: 'Проверьте утечки', detail: 'Резкий скачок расхода воды часто означает подтекающий кран или бачок унитаза — это может быть до 15 л/ч.', savingsHint: 'до 3000 ₸/мес', audiences: ALL_AUDIENCES },
  { id: 'w_aerator', title: 'Поставьте аэратор на кран', detail: 'Насадка-аэратор снижает расход воды из крана на 30-50% без потери напора.', savingsHint: '~2000 ₸/мес', audiences: ALL_AUDIENCES },
  { id: 'w_shower', title: 'Сократите время в душе', detail: 'Душ на 2 минуты короче экономит в среднем 20 литров воды за один раз.', savingsHint: '~1500 ₸/мес', audiences: ['household'] },
  { id: 'w_washer', title: 'Стирайте полной загрузкой', detail: 'Стиральная машина тратит почти одинаково воды на полупустую и полную загрузку — копите бельё.', savingsHint: '~800 ₸/мес', audiences: ['household'] },
  { id: 'w_taps_timer', title: 'Установите смесители с таймером', detail: 'Краны с автоматическим перекрытием воды в санузлах снижают расход при большом потоке людей.', savingsHint: '~2500 ₸/мес', audiences: ['school', 'business'] },
  { id: 'w_staff_habit', title: 'Проведите инструктаж по экономии воды', detail: 'Короткая памятка для сотрудников/учеников о закрытии кранов снижает бытовой перерасход без затрат.', savingsHint: 'без затрат', audiences: ['school', 'business'] },
];

const ELECTRICITY_TIPS = [
  { id: 'e_standby_home', title: 'Отключайте приборы из розетки', detail: 'Техника в режиме ожидания (ТВ, зарядки, роутер) съедает до 8% счёта за электричество.', savingsHint: '~1200 ₸/мес', audiences: ['household'] },
  { id: 'e_standby_org', title: 'Отключайте технику из розетки', detail: 'Оргтехника, зарядные устройства и мониторы в режиме ожидания продолжают потреблять энергию — выключайте их на ночь.', savingsHint: '~2000 ₸/мес', audiences: ['school', 'business'] },
  { id: 'e_led', title: 'Замените лампы на LED', detail: 'LED-лампы потребляют в 5-7 раз меньше энергии, чем лампы накаливания, при том же освещении.', savingsHint: '~1000 ₸/мес', audiences: ALL_AUDIENCES },
  { id: 'e_fridge', title: 'Проверьте уплотнитель холодильника', detail: 'Изношенный уплотнитель заставляет холодильник работать почти непрерывно — это до 20% лишнего расхода.', savingsHint: '~1500 ₸/мес', audiences: ['household', 'business'] },
  { id: 'e_peak', title: 'Сдвиньте пиковые нагрузки', detail: 'Крупную технику лучше не включать всю одновременно в часы пик — это снижает пиковый расход и нагрузку на сеть.', savingsHint: '~700 ₸/мес', audiences: ALL_AUDIENCES },
  { id: 'e_ac', title: 'Настройте кондиционер на 24°C', detail: 'Каждый градус ниже 24°C добавляет примерно 5-8% к расходу кондиционера.', savingsHint: '~2500 ₸/мес', audiences: ALL_AUDIENCES },
  { id: 'e_class_lights', title: 'Используйте датчики движения на освещение', detail: 'Датчики автоматически гасят свет в пустых классах/кабинетах и коридорах.', savingsHint: '~1800 ₸/мес', audiences: ['school', 'business'] },
];

const GENERAL_TIPS = [
  { id: 'g_goal', title: 'Поставьте месячную цель', detail: 'Пользователи с установленной целью экономят в среднем на 12% больше — цель дисциплинирует.', savingsHint: 'дисциплина', audiences: ALL_AUDIENCES },
  { id: 'g_family', title: 'Подключите всю семью', detail: 'Общий семейный аккаунт помогает видеть суммарный расход и вовлекает всех в экономию.', savingsHint: 'вовлечённость', audiences: ['household'] },
  { id: 'g_team', title: 'Подключите сотрудников или учеников', detail: 'Общий аккаунт помогает видеть суммарный расход всей организации и вовлекает людей в экономию.', savingsHint: 'вовлечённость', audiences: ['school', 'business'] },
];

function pick(list, n, seedOffset = 0) {
  // Детерминированный, но "перемешанный" выбор — чтобы советы менялись
  // день ото дня, а не были всегда одним и тем же списком сверху вниз.
  if (list.length === 0) return [];
  const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) + seedOffset;
  const rotated = list.slice(dayIndex % list.length).concat(list.slice(0, dayIndex % list.length));
  return rotated.slice(0, n);
}

function forAudience(list, audience) {
  return list.filter((t) => t.audiences.includes(audience));
}

/**
 * Формирует список персонализированных советов на основе summary.
 * Приоритет: сначала советы по ресурсу с превышением нормы/аномалией,
 * затем общие советы. userType ('household' | 'school' | 'business')
 * отфильтровывает советы, не относящиеся к типу аккаунта (например,
 * советы про стиральную машину или ТВ не показываются школам и бизнесу).
 */
function buildTips(summary, userType = 'household') {
  const audience = ALL_AUDIENCES.includes(userType) ? userType : 'household';
  const waterTips = forAudience(WATER_TIPS, audience);
  const electricityTips = forAudience(ELECTRICITY_TIPS, audience);
  const generalTips = forAudience(GENERAL_TIPS, audience);

  const tips = [];
  const waterOver = summary.benchmark.water_vs_benchmark_percent > 0 || summary.water.trend_percent > 10;
  const electricityOver = summary.benchmark.electricity_vs_benchmark_percent > 0 || summary.electricity.trend_percent > 10;

  if (waterOver) tips.push(...pick(waterTips, 2, 0));
  else tips.push(...pick(waterTips, 1, 1));

  if (electricityOver) tips.push(...pick(electricityTips, 2, 2));
  else tips.push(...pick(electricityTips, 1, 3));

  tips.push(...pick(generalTips, 1, 4));

  return tips.map((t) => ({ ...t, reason: waterOver && t.id.startsWith('w_') ? 'Расход воды выше нормы' : electricityOver && t.id.startsWith('e_') ? 'Расход электричества выше нормы' : 'Общая рекомендация' }));
}

module.exports = { buildTips };
