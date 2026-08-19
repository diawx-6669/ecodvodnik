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

function formatTrendLine(label, emoji, value, unit, cost, trend) {
  const arrow = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
  const sign = trend > 0 ? '+' : '';
  return `${emoji} ${label}: ${value} ${unit} (${cost} ₸), тренд ${arrow} ${sign}${trend}%`;
}

function summaryLines(summary) {
  const lines = [
    formatTrendLine(
      'Вода',
      '💧',
      summary.water.total_liters,
      'л',
      summary.water.cost_kzt,
      summary.water.trend_percent
    ),
    formatTrendLine(
      'Электричество',
      '⚡',
      summary.electricity.total_kwh,
      'кВт·ч',
      summary.electricity.cost_kzt,
      summary.electricity.trend_percent
    ),
  ];
  summary.anomalies.forEach((a) => lines.push(`⚠️ ${a.message}`));
  return lines.join('\n');
}

const GREETING_INTROS = [
  'Привет! Рад тебя видеть 🌱',
  'Хэй! Как дела? Вот что у нас происходит.',
  'О, привет! Заглянул проверить ресурсы?',
];

const HOW_ARE_YOU_REPLIES = {
  happy: [
    'У меня отлично! Расту и зеленею благодаря тебе 🌳',
    'Чувствую себя супер — экономия на этой неделе видна невооружённым глазом!',
  ],
  neutral: [
    'Нормально, держусь. Данные стабильные, ничего драматичного.',
    'Всё спокойно, без сюрпризов на этой неделе.',
  ],
  worried: [
    'Если честно — немного волнуюсь, расход подрос. Давай присмотримся вместе?',
    'Есть небольшая тревога — потребление растёт быстрее обычного.',
  ],
  sad: [
    'Не очень, если честно... кажется, где-то серьёзно утекают ресурсы 😟',
    'Мне тяжеловато сейчас — расход сильно вырос, глянь на аномалии ниже.',
  ],
};

const WATER_ONLY_INTROS = [
  'По воде вот что вижу:',
  'Смотрю на воду —',
  'Разбираю расход воды:',
];

const ELECTRICITY_ONLY_INTROS = [
  'По электричеству картина такая:',
  'Смотрю на свет —',
  'Разбираю потребление электроэнергии:',
];

const THANKS_REPLIES = [
  'Пожалуйста! Я тут ради тебя 🌱',
  'Всегда рад помочь — обращайся!',
  'Не за что, продолжай в том же духе!',
];

const DEFAULT_OUTROS = [
  'Спроси меня про воду, свет, или просто как дела — я на связи!',
  'Если что — я слежу за цифрами и сразу скажу, если что-то не так.',
  'Загляни попозже, обновлю данные, как только будут новые показания.',
];

// Примечание: в JS \b (граница слова) не распознаёт кириллицу как "словесный"
// символ, поэтому вместо regex с \b используем простые проверки includes()/test()
// без анкоров границ — иначе ключевые слова вроде "привет" не будут матчиться.

function ruleBasedReply(summary, petState, userMessage = '') {
  const msg = (userMessage || '').toLowerCase().trim();

  // Приветствие
  if (['привет', 'хай', 'здравствуй', 'hello', 'hi'].some((w) => msg.includes(w))) {
    return `${pick(GREETING_INTROS)}\n\n${summaryLines(summary)}`;
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
      const explanations = summary.anomalies.map((a) => `⚠️ ${a.message}`).join('\n');
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
    return (
      `${pick(WATER_ONLY_INTROS)}\n` +
      formatTrendLine(
        'Вода',
        '💧',
        summary.water.total_liters,
        'л',
        summary.water.cost_kzt,
        summary.water.trend_percent
      ) +
      (summary.water.trend_percent > 15
        ? '\n⚠️ Расход заметно выше обычного — возможно, стоит проверить утечки.'
        : '\nВсё в пределах нормы.')
    );
  }

  // Вопрос только про электричество
  if ((msg.includes('свет') || msg.includes('электр')) && !/вод[аыуе]/.test(msg)) {
    return (
      `${pick(ELECTRICITY_ONLY_INTROS)}\n` +
      formatTrendLine(
        'Электричество',
        '⚡',
        summary.electricity.total_kwh,
        'кВт·ч',
        summary.electricity.cost_kzt,
        summary.electricity.trend_percent
      ) +
      (summary.electricity.trend_percent > 15
        ? '\n⚠️ Потребление выросло — проверь энергоёмкие приборы.'
        : '\nВсё в пределах нормы.')
    );
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
    happy: pick(['Я расту! Спасибо, что бережёшь ресурсы 🌱', 'Дела идут отлично, посмотри:']),
    neutral: pick(['Вот что у нас происходит на этой неделе:', 'Собрал свежую сводку для тебя:']),
    worried: pick(['Хм, расход немного подрос. Присмотримся?', 'Есть на что обратить внимание:']),
    sad: pick(['Ой... мне не очень хорошо, кажется где-то теряются ресурсы.', 'Тревожные новости:']),
  }[petState.mood];

  return `${moodIntro}\n\n${summaryLines(summary)}\n\n${pick(DEFAULT_OUTROS)}`;
}

function ruleBasedRecommendations(summary) {
  const recs = [];

  if (summary.water.trend_percent > 15) {
    recs.push({
      title: 'Проверьте сантехнику на утечки',
      detail:
        'Расход воды вырос заметно сильнее обычного. Даже небольшая капающая труба ' +
        'может расходовать десятки литров в день.',
      estimated_savings_kzt_per_month: Math.round(summary.water.cost_kzt * 0.3 * 4.3),
    });
  }

  if (summary.electricity.trend_percent > 15) {
    recs.push({
      title: 'Проверьте энергоёмкие приборы',
      detail:
        'Электропотребление выросло. Возможно, стоит проверить обогреватели, ' +
        'кондиционер или старую технику класса ниже A.',
      estimated_savings_kzt_per_month: Math.round(summary.electricity.cost_kzt * 0.2 * 4.3),
    });
  }

  if (recs.length === 0) {
    recs.push({
      title: 'Всё стабильно — можно двигаться дальше',
      detail: 'Попробуйте заменить лампы накаливания на LED, если ещё не сделали этого.',
      estimated_savings_kzt_per_month: 1500,
    });
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Опциональный вызов реального LLM (Anthropic API), если задан ключ.
// Если ключа нет — используем rule-based заглушку выше.
// ---------------------------------------------------------------------------

async function llmReply(summary, petState, userMessage) {
  if (!config.anthropicApiKey) {
    return ruleBasedReply(summary, petState, userMessage);
  }

  try {
    const systemPrompt =
      'Ты — дружелюбный цифровой питомец-ассистент приложения ЭкоДвойник. ' +
      'Ты живёшь в доме пользователя и "чувствуешь" на себе его потребление ресурсов. ' +
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

    return text || ruleBasedReply(summary, petState, userMessage);
  } catch (err) {
    console.error('AI service error, falling back to rule-based:', err.message);
    return ruleBasedReply(summary, petState, userMessage);
  }
}

module.exports = { ruleBasedReply, ruleBasedRecommendations, llmReply };
