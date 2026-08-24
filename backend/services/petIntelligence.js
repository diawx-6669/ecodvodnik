/**
 * Интеллектуальная система выбора ответа питомца
 * Анализирует контекст сообщения и состояние питомца
 * для подбора наиболее уместного ответа
 */

function analyzeMessageContext(userMessage) {
  const msg = (userMessage || '').toLowerCase().trim();

  return {
    isGreeting: ['привет', 'хай', 'hello', 'здравствуй'].some((w) => msg.includes(w)),
    isQuestion: msg.endsWith('?') || ['как', 'что', 'почему', 'где', 'когда'].some((w) => msg.startsWith(w)),
    isPositive: ['спасибо', 'спс', 'благодар', 'молод', 'хорош', 'класс', 'отлич'].some((w) => msg.includes(w)),
    isNegative: ['нет', 'плох', 'ужас', 'ой', 'блин', 'помощь', 'беда'].some((w) => msg.includes(w)),
    isRequest: ['помог', 'совет', 'рекомендац', 'сделай', 'дай'].some((w) => msg.includes(w)),
    // Диапазон U+1F600–U+1F64F — эмодзи-смайлы (лица), которыми пользователь
    // мог выразить сильную эмоцию (плач, злость, испуг и т.п.).
    isEmotional: /[\u{1F600}-\u{1F64F}]/u.test(msg),
    hasEmoji: /[\u{1F300}-\u{1F9FF}]/u.test(msg),
  };
}

function scoreMessageRelevance(context, moodType) {
  let score = 0;

  // Позитивные сообщения с счастливым питомцем = отличная комбо
  if (context.isPositive && moodType === 'happy') score += 10;

  // Негативные сообщения с грустным питомцем = естественная реакция
  if (context.isNegative && moodType === 'sad') score += 8;

  // Вопросы почти всегда уместны
  if (context.isQuestion) score += 5;

  // Запросы о помощи важны
  if (context.isRequest) score += 7;

  // Эмоциональные сообщения требуют эмоционального ответа
  if (context.isEmotional) score += 6;

  return score;
}

function selectBestResponse(possibleResponses, context, petState) {
  if (!Array.isArray(possibleResponses) || possibleResponses.length === 0) {
    return 'Привет! Я вас слушаю.';
  }

  // Если только один вариант — возвращаем его
  if (possibleResponses.length === 1) {
    return possibleResponses[0];
  }

  // Выбираем случайный, но отдаём предпочтение соответствующему настроению
  const contextAnalysis = analyzeMessageContext(context.userMessage || '');

  // Если есть специфичная фраза для настроения — берём её
  if (contextAnalysis.isPositive && petState.mood === 'happy') {
    return possibleResponses[Math.floor(Math.random() * possibleResponses.length)];
  }

  if (contextAnalysis.isNegative && petState.mood === 'sad') {
    return possibleResponses[Math.floor(Math.random() * possibleResponses.length)];
  }

  // По умолчанию случайный выбор
  return possibleResponses[Math.floor(Math.random() * possibleResponses.length)];
}

/**
 * Генерирует персонализированный ответ на основе истории чата
 */
function generatePersonalizedResponse(summary, petState, messageHistory = []) {
  const recentMessages = messageHistory.slice(-3) || [];
  const userHasAskedAbout = {
    water: recentMessages.some((m) => m.text && /вод[аыуе]/.test(m.text.toLowerCase())),
    electricity: recentMessages.some((m) => m.text && /электр|свет/.test(m.text.toLowerCase())),
    money: recentMessages.some((m) => m.text && /дене?г|тенге|₸|стоим|цен/.test(m.text.toLowerCase())),
    general: recentMessages.length > 0,
  };

  return {
    focus: Object.entries(userHasAskedAbout)
      .filter(([_, v]) => v)
      .map(([k]) => k),
    shouldMention: userHasAskedAbout.general ? 'trends' : 'overview',
    tone: petState.mood,
  };
}

module.exports = {
  analyzeMessageContext,
  scoreMessageRelevance,
  selectBestResponse,
  generatePersonalizedResponse,
};
