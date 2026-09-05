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
          : '\nОтличный результат, продолжай так же!'),
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
// Опциональный вызов реального LLM (Gemini API от Google), если задан ключ.
// Если ключа нет — используем rule-based заглушку выше.
// ---------------------------------------------------------------------------

const GEMINI_TEXT_MODEL = 'gemini-flash-latest';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function llmReply(summary, petState, userMessage, user = null) {
  if (!config.geminiApiKey) {
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

    const response = await fetch(
      `${GEMINI_API_BASE}/${GEMINI_TEXT_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: userMessage || 'Расскажи, как у нас дела с ресурсами на этой неделе?',
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 300 },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error('Gemini API error:', response.status, errBody);
      return ruleBasedReply(summary, petState, userMessage, user);
    }

    const data = await response.json();
    const text = (data.candidates || [])
      .flatMap((c) => (c.content && c.content.parts) || [])
      .map((part) => part.text || '')
      .filter(Boolean)
      .join('\n');

    return text || ruleBasedReply(summary, petState, userMessage, user);
  } catch (err) {
    console.error('AI service error, falling back to rule-based:', err.message);
    return ruleBasedReply(summary, petState, userMessage, user);
  }
}

// ---------------------------------------------------------------------------
// Распознавание фото счётчика или квитанции через Claude Vision.
//
// Пользователь фотографирует показания счётчика (воды/электричества) или
// квитанцию об оплате — модель должна вытащить оттуда тип ресурса, значение
// показания и (если это квитанция) сумму/период, а не выдумывать цифры.
// ---------------------------------------------------------------------------

const METER_ANALYSIS_SYSTEM_PROMPT =
  'Ты помогаешь распознавать фотографии счётчиков воды/электричества и ' +
  'квитанций об оплате коммунальных услуг в приложении ЭкоДвойник (Казахстан). ' +
  'Внимательно посмотри на изображение и определи:\n' +
  '- document_type: "meter" (сфотографирован сам счётчик с цифрами на циферблате/дисплее) ' +
  'или "receipt" (квитанция/счёт на оплату) или "unknown" (не удалось разобрать, ' +
  'плохое качество, или на фото вообще не счётчик и не квитанция).\n' +
  '- resource_type: "water" или "electricity" — определи по виду счётчика ' +
  '(водяной счётчик обычно с роликами-цифрами и синей/красной меткой, ' +
  'электросчётчик — с ЖК/электромеханическим дисплеем кВт·ч) или по тексту ' +
  'квитанции. Если не уверен — null.\n' +
  '- value: числовое значение показания счётчика (текущее показание, которое ' +
  'нужно ввести в приложение). Для квитанции — новое (последнее) показание из неё, ' +
  'если оно там указано, иначе null. Бери ТОЛЬКО те цифры, которые реально видишь ' +
  'на фото — никогда не придумывай и не угадывай значение, если оно нечитаемо.\n' +
  '- unit: "л" для воды или "кВт·ч" для электричества, если применимо, иначе null.\n' +
  '- cost_kzt: сумма к оплате в тенге, если это квитанция и сумма видна, иначе null.\n' +
  '- period: период квитанции (например "Март 2026"), если виден, иначе null.\n' +
  '- confidence: число от 0 до 1 — насколько ты уверен в распознанном value ' +
  '(0 — совсем не уверен/не разобрал, 1 — цифры чёткие и однозначные).\n' +
  '- notes: короткий комментарий человеку на русском (1 предложение) — например, ' +
  'что именно ты увидел, или почему не смог распознать (блики, размытость, ' +
  'обрезанный кадр и т.д.).\n\n' +
  'Отвечай СТРОГО в виде одного JSON-объекта без markdown-разметки, без ```, ' +
  'без пояснений до или после — только сам JSON с полями: ' +
  'document_type, resource_type, value, unit, cost_kzt, period, confidence, notes.';

const SUPPORTED_IMAGE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// meta-llama/llama-4-scout-17b-16e-instruct раньше была основной vision-моделью
// Groq, но сам Groq отключил её (деприкейт с рассылкой пользователям) — любой
// запрос к ней стабильно отвечал ошибкой, отсюда "Сервис распознавания
// временно недоступен" даже при правильно настроенном ключе. Актуальная (на
// момент правки) vision-модель на бесплатном тарифе Groq — qwen/qwen3.6-27b:
// понимает картинки, до 5 изображений за запрос, поддерживает JSON mode.
const GROQ_VISION_MODEL = 'qwen/qwen3.6-27b';
const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

function parseImageDataUrl(imageDataUrl) {
  if (typeof imageDataUrl !== 'string') return null;
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) return null;
  const [, mediaType, base64Data] = match;
  if (!SUPPORTED_IMAGE_MEDIA_TYPES.has(mediaType)) return null;
  return { mediaType, base64Data };
}

function extractJsonBlock(text) {
  if (!text) return null;
  // Модель иногда всё же оборачивает JSON в ```json ... ``` — на всякий случай снимаем.
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (err) {
    return null;
  }
}

// analyzeMeterPhoto(imageDataUrl) -> { ok, data?, error? }
async function analyzeMeterPhoto(imageDataUrl) {
  const parsed = parseImageDataUrl(imageDataUrl);
  if (!parsed) {
    return {
      ok: false,
      error: 'Не удалось прочитать изображение. Поддерживаются JPG, PNG, WEBP, GIF.',
    };
  }

  if (!config.groqApiKey) {
    return {
      ok: false,
      error:
        'Распознавание фото недоступно: на сервере не настроен GROQ_API_KEY. ' +
        'Введите показание вручную.',
    };
  }

  try {
    const response = await fetch(
      GROQ_CHAT_COMPLETIONS_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.groqApiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_VISION_MODEL,
          messages: [
            {
              role: 'system',
              content: METER_ANALYSIS_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text:
                    'Распознай это изображение (счётчик воды/электричества или квитанция) ' +
                    'и верни JSON строго по описанной схеме.',
                },
                {
                  type: 'image_url',
                  image_url: { url: imageDataUrl },
                },
              ],
            },
          ],
          // Groq API (OpenAI-совместимый) в актуальных примерах использует
          // max_completion_tokens; старое имя max_tokens тоже как правило
          // принимается, но лучше сразу соответствовать документации.
          max_completion_tokens: 500,
          response_format: { type: 'json_object' },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error('Groq vision API error:', response.status, errBody);
      return {
        ok: false,
        error: 'Сервис распознавания временно недоступен. Попробуйте ещё раз или введите вручную.',
      };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    const parsedJson = extractJsonBlock(text);
    if (!parsedJson) {
      return {
        ok: false,
        error: 'Не удалось распознать данные на фото. Попробуйте сделать снимок чётче.',
      };
    }

    // Санитизация: не доверяем модели слепо, приводим типы и проверяем разумность.
    const resourceType = ['water', 'electricity'].includes(parsedJson.resource_type)
      ? parsedJson.resource_type
      : null;
    const numericValue = Number(parsedJson.value);
    const value = Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 999999
      ? numericValue
      : null;
    const numericCost = Number(parsedJson.cost_kzt);
    const costKzt = Number.isFinite(numericCost) && numericCost >= 0 ? numericCost : null;
    const numericConfidence = Number(parsedJson.confidence);
    const confidence = Number.isFinite(numericConfidence)
      ? Math.max(0, Math.min(1, numericConfidence))
      : 0;

    return {
      ok: true,
      data: {
        documentType: ['meter', 'receipt'].includes(parsedJson.document_type)
          ? parsedJson.document_type
          : 'unknown',
        resourceType,
        value,
        unit: typeof parsedJson.unit === 'string' ? parsedJson.unit : null,
        costKzt,
        period: typeof parsedJson.period === 'string' ? parsedJson.period : null,
        confidence,
        notes: typeof parsedJson.notes === 'string' ? parsedJson.notes : '',
      },
    };
  } catch (err) {
    console.error('AI vision service error:', err.message);
    return {
      ok: false,
      error: 'Ошибка при обращении к сервису распознавания. Попробуйте позже или введите вручную.',
    };
  }
}

module.exports = {
  ruleBasedReply,
  ruleBasedRecommendations,
  llmReply,
  analyzeMeterPhoto,
};
