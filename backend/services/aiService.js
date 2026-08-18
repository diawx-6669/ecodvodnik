const config = require('../config/config');

// ---------------------------------------------------------------------------
// Rule-based fallback (работает без интернета и без API-ключа — на всякий
// случай, чтобы демо на хакатоне никогда не сломалось).
// ---------------------------------------------------------------------------

function ruleBasedReply(summary, petState) {
  const lines = [];

  if (petState.mood === 'sad') {
    lines.push('Ой... мне не очень хорошо. Кажется, где-то теряются ресурсы.');
  } else if (petState.mood === 'worried') {
    lines.push('Хм, расход немного подрос на этой неделе. Присмотримся?');
  } else if (petState.mood === 'happy') {
    lines.push('Я расту! Спасибо, что бережёшь ресурсы 🌱');
  } else {
    lines.push('Привет! Вот что у нас происходит на этой неделе.');
  }

  lines.push(
    `Вода: ${summary.water.total_liters} л (${summary.water.cost_kzt} ₸), ` +
      `тренд ${summary.water.trend_percent > 0 ? '+' : ''}${summary.water.trend_percent}%.`
  );
  lines.push(
    `Электричество: ${summary.electricity.total_kwh} кВт·ч (${summary.electricity.cost_kzt} ₸), ` +
      `тренд ${summary.electricity.trend_percent > 0 ? '+' : ''}${summary.electricity.trend_percent}%.`
  );

  summary.anomalies.forEach((a) => lines.push(`⚠️ ${a.message}`));

  return lines.join('\n');
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
    return ruleBasedReply(summary, petState);
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

    return text || ruleBasedReply(summary, petState);
  } catch (err) {
    console.error('AI service error, falling back to rule-based:', err.message);
    return ruleBasedReply(summary, petState);
  }
}

module.exports = { ruleBasedReply, ruleBasedRecommendations, llmReply };
