const config = require('../config/config');

// ---------------------------------------------------------------------------
// Rule-based fallback (работает без интернета и без API-ключа — на всякий
// случай, чтобы демо на хакатоне никогда не сломалось).
//
// Важно: ответ должен зависеть и от настроения/данных, И от того, что
// написал пользователь — иначе питомец превращается в "попугая", который
// присылает один и тот же текст на любое сообщение.
// ---------------------------------------------------------------------------

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatTrendLine(label, value, unit, cost, trend) {
  const arrow = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
  const sign = trend > 0 ? '+' : '';
  return `${label}: ${value} ${unit} (${cost} ₸), тренд ${arrow} ${sign}${trend}%`;
}

function summaryLines(summary) {
  const lines = [
    formatTrendLine(
      'Вода',
      summary.water.total_liters,
      'л',
      summary.water.cost_kzt,
      summary.water.trend_percent
    ),
    formatTrendLine(
      'Электричество',
      summary.electricity.total_kwh,
      'кВт·ч',
      summary.electricity.cost_kzt,
      summary.electricity.trend_percent
    ),
  ];
  summary.anomalies.forEach((a) => lines.push(a.message));
  return lines.join('\n');
}

const GREETING_INTROS = [
  'Привет! Рад тебя видеть.',
  'Хэй! Как дела? Вот что у нас происходит.',
  'О, привет! Заглянул проверить ресурсы?',
  'Снова ты! Давай разбираться в цифрах.',
  'Привет, друже! Есть обновления.',
  'Хорошо, что зашёл! Много интересного на этой неделе.',
  'Явился! Смотрим свежую сводку?',
];

const HOW_ARE_YOU_REPLIES = {
  angry: [
    'Честно? Я злюсь. Расход слишком большой.',
    'Я весь красный от досады — нужно срочно экономить.',
    'Настроение боевое и злое: так тратить нельзя.',
  ],
  happy: [
    'У меня отлично! Расту и зеленею благодаря тебе.',
    'Чувствую себя супер — экономия на этой неделе видна невооружённым глазом!',
    'Просто чудесно! Ты же видишь — я вовсю стараюсь расти,',
    'Прекрасно себя чувствую! Ты молодец, продолжай так же.',
    'На луне! Благодаря тебе я становлюсь всё красивее.',
    'Отлично! Можно ещё быстрее экономить?',
  ],
  neutral: [
    'Нормально, держусь. Данные стабильные, ничего драматичного.',
    'Всё спокойно, без сюрпризов на этой неделе.',
    'Как обычно — ничего особенного, но и беспокоиться не о чем.',
    'Стабильно. Вот такая стабильность и нужна нам обоим.',
    'Спокойная неделя. Иногда и такое бывает полезно.',
    'Держу форму. Всё идёт по плану.',
  ],
  worried: [
    'Если честно — немного волнуюсь, расход подрос. Давай присмотримся вместе?',
    'Есть небольшая тревога — потребление растёт быстрее обычного.',
    'Хм, кажется, что-то не то. Расход заметно выше, чем раньше.',
    'Беспокоюсь я... может, утечка где-то? Или приборы давают сбой?',
    'Слегка волнуюсь... видишь ли, цифры меня смущают. Давай разберёмся?',
    'Не совсем спокойно мне... может, проверишь что-нибудь?',
  ],
  sad: [
    'Не очень, если честно... кажется, где-то серьёзно утекают ресурсы.',
    'Мне тяжеловато сейчас — расход сильно вырос, глянь на аномалии ниже.',
    'Мне грустно... огромный расход этой неделе. Помоги мне, пожалуйста!',
    'О ужас! Что-то совсем пошло не так. Смотри, какие цифры!',
    'Печально мне... я вянешь, а ресурсы тают. Спасай!',
    'Совсем тоскливо на душе... надеюсь, ты поможешь это исправить.',
  ],
};

const WATER_ONLY_INTROS = [
  'По воде вот что вижу:',
  'Смотрю на воду —',
  'Разбираю расход воды:',
  'Вода, вода... вот сводка:',
  'Моя любимая тема! По воде вот что:',
  'Погляди, какая история с водой:',
];

const ELECTRICITY_ONLY_INTROS = [
  'По электричеству картина такая:',
  'Смотрю на свет —',
  'Разбираю потребление электроэнергии:',
  'Электричество, самый энергоёмкий вопрос:',
  'По поводу света и энергии — вот факты:',
  'Киловатт-часы, покажу, что я узнал:',
];

const THANKS_REPLIES = [
  'Пожалуйста! Я тут ради тебя.',
  'Всегда рад помочь — обращайся!',
  'Не за что, продолжай в том же духе!',
  'Спасибо тебе за внимание! Вместе мы на пути к экономии.',
  'Рад помочь! Это же моя прямая обязанность.',
  'Конечно! Для тебя я всегда готов.',
  'Да ладно, это же я делаю с удовольствием!',
];

const DEFAULT_OUTROS = [
  'Спроси меня про воду, свет, или просто как дела — я на связи!',
  'Если что — я слежу за цифрами и сразу скажу, если что-то не так.',
  'Загляни попозже, обновлю данные, как только будут новые показания.',
  'Есть вопросы? Я весь в твоём распоряжении!',
  'Больше данных — точнее рекомендации. Жди свежих показаний!',
  'Как ты тратишь, так я расту. Вместе к лучшему результату!',
  'Помни: каждый киловатт и литр учтены. Ты в курсе?',
];

// Примечание: в JS \b (граница слова) не распознаёт кириллицу как "словесный"
// символ, поэтому вместо regex с \b используем простые проверки includes()/test()
// без анкоров границ — иначе ключевые слова вроде "привет" не будут матчиться.

function ruleBasedReply(summary, petState, userMessage = '', user = null) {
  const msg = (userMessage || '').toLowerCase().trim();

  // Приветствие — если человек вошёл в аккаунт, обращаемся по имени
  if (['привет', 'хай', 'здравствуй', 'hello', 'hi'].some((w) => msg.includes(w))) {
    const namePart = user && user.name ? ` ${user.name}` : '';
    return `${pick(GREETING_INTROS)}${namePart}\n\n${summaryLines(summary)}`;
  }

  // "Как дела?"
  if (
    ['как дела', 'как у нас дела', 'как ты', 'как жизнь', 'что нового'].some((w) =>
      msg.includes(w)
    )
  ) {
    const feeling = pick(HOW_ARE_YOU_REPLIES[petState.mood] || HOW_ARE_YOU_REPLIES.neutral);
    return `${feeling}\n\n${summaryLines(summary)}`;
  }

  // Вопрос "почему" — объясняем через аномалии, если они есть
  if (msg.includes('почему') || msg.includes('из-за чего') || msg.includes('отчего')) {
    if (summary.anomalies.length > 0) {
      const explanations = summary.anomalies.map((a) => a.message).join('\n');
      return `Скорее всего вот почему:\n${explanations}\n\nПроверь рекомендации ниже — там конкретные шаги.`;
    }
    return 'Пока не вижу явных причин для беспокойства — цифры в пределах нормы. Загляни в сводку ниже.';
  }

  // Просьба дать совет/рекомендацию
  if (
    ['совет', 'рекоменд', 'как сэконом'].some((w) => msg.includes(w)) ||
    (msg.includes('что') && msg.includes('делать'))
  ) {
    return 'Загляни в раздел "Рекомендации" на дашборде справа — там конкретные советы с расчётом экономии в тенге. Обновляю их каждый раз, когда приходят новые данные.';
  }

  // Вопрос только про воду
  if (/вод[аыуе]/.test(msg) && !(msg.includes('свет') || msg.includes('электр'))) {
    const waterResponses = [
      (trend) =>
        `${pick(WATER_ONLY_INTROS)}\n` +
        formatTrendLine(
          'Вода',
          summary.water.total_liters,
          'л',
          summary.water.cost_kzt,
          summary.water.trend_percent
        ) +
        (trend > 15
          ? '\nРасход заметно выше обычного — возможно, стоит проверить утечки.'
          : trend < -10
          ? '\nСтрашно хороший результат! Ты чемпион по экономии воды!'
          : '\nВсё в пределах нормы, молодец!'),
      (trend) =>
        `${pick(WATER_ONLY_INTROS)}\n` +
        formatTrendLine('Вода', summary.water.total_liters, 'л', summary.water.cost_kzt, trend) +
        (trend > 20
          ? '\nЭто много! Проверь: кран капает? Туалет пускает? Обычно это главные утечки.'
          : trend > 15
          ? '\nНе критично, но выше нормы. Можно оптимизировать.'
          : '\n✓ Отличный результат, продолжай так же!'),
    ];
    return pick(waterResponses)(summary.water.trend_percent);
  }

  // Вопрос только про электричество
  if ((msg.includes('свет') || msg.includes('электр')) && !/вод[аыуе]/.test(msg)) {
    const electricityResponses = [
      (trend) =>
        `${pick(ELECTRICITY_ONLY_INTROS)}\n` +
        formatTrendLine('Электричество', summary.electricity.total_kwh, 'кВт·ч', summary.electricity.cost_kzt, trend) +
        (trend > 15
          ? '\nПотребление выросло — проверь энергоёмкие приборы.'
          : trend < -10
          ? '\nВау! Такая экономия электричества — прямо герой!'
          : '\nВсё в норме!'),
      (trend) =>
        `${pick(ELECTRICITY_ONLY_INTROS)}\n` +
        formatTrendLine('Электричество', summary.electricity.total_kwh, 'кВт·ч', summary.electricity.cost_kzt, trend) +
        (trend > 20
          ? '\nОчень много! Может быть: кондиционер 24/7? Обогреватель? Старый холодильник?'
          : trend > 15
          ? '\nЧуть выше обычного. LED лампы? Они помогают.'
          : '\nСупер! Ты эффективен!'),
    ];
    return pick(electricityResponses)(summary.electricity.trend_percent);
  }

  // Вопрос про экономию/деньги
  if (['эконом', 'деньг', 'тенге', '₸', 'сколько'].some((w) => msg.includes(w))) {
    return `За эту неделю в сумме ушло ${summary.total_cost_kzt} ₸.\n\n${summaryLines(summary)}`;
  }

  // Благодарность
  if (['спасибо', 'благодар', 'спс'].some((w) => msg.includes(w))) {
    return pick(THANKS_REPLIES);
  }

  // По умолчанию — реагируем на настроение + сводка + разный outro
  const moodIntro = {
    happy: pick([
      'Я расту! Спасибо, что бережёшь ресурсы.',
      'Дела идут отлично, посмотри:',
      'Вот это да! Такая экономия — я просто расцветаю!',
      'Ты молод! Смотри, какие числа:',
      'Гордость переполняет! Вот наши итоги:',
    ]),
    neutral: pick([
      'Вот что у нас происходит на этой неделе:',
      'Собрал свежую сводку для тебя:',
      'Стабильная неделя, вот цифры:',
      'Ничего экстраординарного, но полезно знать:',
      'Обычная картина, смотрим:',
    ]),
    worried: pick([
      'Хм, расход немного подрос. Присмотримся?',
      'Есть на что обратить внимание:',
      'Кое-что беспокоит меня в этих данных:',
      'Пора поговорить о росте расходов:',
      'Видишь ли, есть нюансы:',
    ]),
    angry: pick([
      'Я злюсь. Ресурсы утекают, и это уже слишком.',
      'Так дело не пойдёт — расход вышел из-под контроля:',
      'Я отвернулся и краснею от этих чисел:',
      'Хватит! Пора срочно разбираться:',
      'Меня это по-настоящему разозлило. Смотри:',
    ]),
    sad: pick([
      'Ой... мне не очень хорошо, кажется где-то теряются ресурсы.',
      'Тревожные новости:',
      'Мне очень грустно от этих чисел:',
      'Помощь нужна! Смотрим критичное:',
      'О, беда! Вот в чём дело:',
    ]),
  }[petState.mood] || 'Вот свежая сводка:';

  return `${moodIntro}\n\n${summaryLines(summary)}\n\n${pick(DEFAULT_OUTROS)}`;
}

function ruleBasedRecommendations(summary) {
  const recs = [];

  if (summary.water.trend_percent > 15) {
    const waterRecs = [
      {
        title: 'Проверьте сантехнику на утечки',
        detail:
          'Расход воды вырос заметно сильнее обычного. Даже небольшая капающая труба ' +
          'может расходовать десятки литров в день.',
        estimated_savings_kzt_per_month: Math.round(summary.water.cost_kzt * 0.3 * 4.3),
      },
      {
        title: 'Утечка воды — главный враг экономии',
        detail:
          'Один кран, капающий 1 каплю в секунду, растрачивает более 2600 литров в год. ' +
          'Проверь все краны и трубы — не капают ли они?',
        estimated_savings_kzt_per_month: Math.round(summary.water.cost_kzt * 0.25 * 4.3),
      },
    ];
    recs.push(pick(waterRecs));
  }

  if (summary.electricity.trend_percent > 15) {
    const electricRecs = [
      {
        title: 'Проверьте энергоёмкие приборы',
        detail:
          'Электропотребление выросло. Возможно, стоит проверить обогреватели, ' +
          'кондиционер или старую технику класса ниже A.',
        estimated_savings_kzt_per_month: Math.round(summary.electricity.cost_kzt * 0.2 * 4.3),
      },
      {
        title: 'Климатические приборы — главные потребители энергии',
        detail:
          'Кондиционер, обогреватель и тепловая пушка расходуют львиную долю электричества. ' +
          'Используй их только при необходимости и устанавливай оптимальную температуру.',
        estimated_savings_kzt_per_month: Math.round(summary.electricity.cost_kzt * 0.3 * 4.3),
      },
      {
        title: 'Замените лампы на LED',
        detail:
          'LED лампы потребляют на 80% меньше электричества, чем лампы накаливания. ' +
          'Замена дорогая один раз, экономия — постоянная!',
        estimated_savings_kzt_per_month: Math.round(summary.electricity.cost_kzt * 0.15 * 4.3),
      },
    ];
    recs.push(pick(electricRecs));
  }

  if (recs.length === 0) {
    const stableRecs = [
      {
        title: 'Всё стабильно — можно двигаться дальше',
        detail:
          'Попробуйте заменить лампы накаливания на LED, если ещё не сделали этого. ' +
          'Это наиболее эффективный способ снизить расход электричества.',
        estimated_savings_kzt_per_month: 1500,
      },
      {
        title: 'Ты на правильном пути!',
        detail:
          'Потребление в норме. Совет: установи датчик влажности в ванной — ' +
          'вытяжка будет работать только когда нужно, экономя электричество.',
        estimated_savings_kzt_per_month: 800,
      },
      {
        title: 'Поздравляю с экономией!',
        detail:
          'Расход стабилен. Следующий шаг — возобновляемая энергия. ' +
          'Даже небольшая солнечная панель может помочь.',
        estimated_savings_kzt_per_month: 2000,
      },
    ];
    recs.push(pick(stableRecs));
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Опциональный вызов реального LLM (Anthropic API), если задан ключ.
// Если ключа нет — используем rule-based заглушку выше.
// ---------------------------------------------------------------------------

async function llmReply(summary, petState, userMessage, user = null) {
  if (!config.anthropicApiKey) {
    return ruleBasedReply(summary, petState, userMessage, user);
  }

  try {
    const AUDIENCE_LABELS = { household: 'дом', school: 'школа', business: 'малый бизнес' };
    const audienceContext = user
      ? `Пользователя зовут ${user.name}, тип аккаунта — ${AUDIENCE_LABELS[user.type] || 'дом'}` +
        (user.organizationName ? ` (${user.organizationName})` : '') +
        `. Обращайся к нему по имени иногда. `
      : '';

    const systemPrompt =
      'Ты — дружелюбный цифровой питомец-ассистент приложения ЭкоДвойник. ' +
      'Ты живёшь у пользователя (это может быть жилой дом, школа или малый бизнес) и ' +
      '"чувствуешь" на себе его потребление ресурсов. ' +
      audienceContext +
      'Отвечай коротко (2-4 предложения), тепло и с характером, на основе данных ниже. ' +
      'Данные пользователя: ' +
      JSON.stringify(summary) +
      '. Твоё текущее настроение: ' +
      petState.mood +
      '.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage || 'Расскажи, как у нас дела с ресурсами на этой неделе?',
          },
        ],
      }),
    });

    const data = await response.json();
    const text = (data.content || [])
      .map((block) => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n');

    return text || ruleBasedReply(summary, petState, userMessage, user);
  } catch (err) {
    console.error('AI service error, falling back to rule-based:', err.message);
    return ruleBasedReply(summary, petState, userMessage, user);
  }
}

module.exports = { ruleBasedReply, ruleBasedRecommendations, llmReply };
