const config = require('../config/config');

// Небольшой локальный справочник популярных моделей — работает без интернета/API.
const KNOWN_MODELS = {
  'samsung rb33': {
    brand: 'Samsung',
    model: 'RB33',
    energyClass: 'A+',
    ratedWatts: 150,
    annualKwh: 280,
    typicalHoursPerDay: 24,
    category: 'refrigerator',
    workloadFactors: [
      { condition: 'Нормальная загрузка', consumptionKwh: 0.75, unit: 'сутки' },
      { condition: 'Частое открывание двери', consumptionKwh: 0.95, unit: 'сутки' },
    ],
    description: 'Двухкамерный холодильник No Frost, ~280 кВт·ч/год при стандартном режиме.',
  },
  'lg f2j5ns0w': {
    brand: 'LG',
    model: 'F2J5NS0W',
    energyClass: 'A+++',
    ratedWatts: 2100,
    annualKwh: 175,
    typicalHoursPerDay: 1,
    category: 'washer',
    workloadFactors: [
      { condition: '3 кг белья, 40°C', consumptionKwh: 0.45, unit: 'стирка' },
      { condition: '5 кг белья, 60°C', consumptionKwh: 0.85, unit: 'стирка' },
      { condition: '7 кг белья, 60°C', consumptionKwh: 1.05, unit: 'стирка' },
    ],
    description: 'Стиральная машина 7 кг, класс A+++, средний цикл ~0.7–0.9 кВт·ч.',
  },
  'bosch wau28ph90': {
    brand: 'Bosch',
    model: 'WAU28PH90',
    energyClass: 'A',
    ratedWatts: 2300,
    annualKwh: 155,
    typicalHoursPerDay: 1,
    category: 'washer',
    workloadFactors: [
      { condition: '4 кг, 40°C', consumptionKwh: 0.5, unit: 'стирка' },
      { condition: '8 кг, 60°C', consumptionKwh: 1.1, unit: 'стирка' },
    ],
    description: 'Стиральная машина Serie 6, 8 кг, энергоэффективность класса A.',
  },
};

const CATEGORY_DEFAULTS = {
  refrigerator: {
    energyClass: 'A+',
    ratedWatts: 150,
    annualKwh: 300,
    typicalHoursPerDay: 24,
    workloadFactors: [
      { condition: 'Стандартная загрузка', consumptionKwh: 0.8, unit: 'сутки' },
    ],
    description: 'Типичный бытовой холодильник: ~250–350 кВт·ч/год, работает круглосуточно.',
  },
  washer: {
    energyClass: 'A',
    ratedWatts: 2000,
    annualKwh: 180,
    typicalHoursPerDay: 1,
    workloadFactors: [
      { condition: '3 кг, 40°C', consumptionKwh: 0.45, unit: 'стирка' },
      { condition: '5 кг, 60°C', consumptionKwh: 0.85, unit: 'стирка' },
      { condition: '7 кг, 60°C', consumptionKwh: 1.05, unit: 'стирка' },
    ],
    description: 'Типичная стиральная машина: пик ~2 кВт, цикл 0.5–1.2 кВт·ч в зависимости от загрузки.',
  },
  tv: {
    energyClass: 'A',
    ratedWatts: 100,
    annualKwh: 120,
    typicalHoursPerDay: 4,
    workloadFactors: [
      { condition: 'Яркость 50%', consumptionKwh: 0.3, unit: '4 ч просмотра' },
      { condition: 'Яркость 100%', consumptionKwh: 0.5, unit: '4 ч просмотра' },
    ],
    description: 'LED-телевизор 55": ~80–150 Вт в работе.',
  },
  ac: {
    energyClass: 'A',
    ratedWatts: 1200,
    annualKwh: 600,
    typicalHoursPerDay: 6,
    workloadFactors: [
      { condition: 'Охлаждение +24°C на улице', consumptionKwh: 1.5, unit: 'час' },
      { condition: 'Охлаждение +35°C на улице', consumptionKwh: 2.5, unit: 'час' },
    ],
    description: 'Сплит-система 2.5 кВт: 800–2500 Вт в зависимости от температуры.',
  },
  default: {
    energyClass: '—',
    ratedWatts: null,
    annualKwh: null,
    typicalHoursPerDay: null,
    workloadFactors: [],
    description: 'Укажите точную модель для более точного поиска.',
  },
};

function normalizeKey(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9а-яё\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function detectCategory(name) {
  const n = normalizeKey(name);
  if (/холод|fridge|refrigerat/.test(n)) return 'refrigerator';
  if (/стирал|washer|wash/.test(n)) return 'washer';
  if (/телевиз|tv|телек/.test(n)) return 'tv';
  if (/кондиц|сплит|ac|air.?cond/.test(n)) return 'ac';
  return 'default';
}

function findInCatalog(name, model) {
  const combined = normalizeKey(`${name} ${model}`);
  for (const [key, specs] of Object.entries(KNOWN_MODELS)) {
    if (combined.includes(key) || key.includes(normalizeKey(model))) {
      return { ...specs, source: 'catalog' };
    }
  }
  return null;
}

function fallbackLookup(name, model) {
  const catalogHit = findInCatalog(name, model);
  if (catalogHit) return catalogHit;

  const category = detectCategory(name);
  const defaults = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.default;
  return {
    brand: model ? model.split(/\s+/)[0] : null,
    model: model || null,
    category,
    source: 'fallback',
    ...defaults,
  };
}

function parseJsonFromText(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function llmLookup(name, model) {
  const systemPrompt =
    'Ты — эксперт по бытовой технике и энергоэффективности. ' +
    'Пользователь вводит название и модель прибора. ' +
    'На основе своих знаний о реальных характеристиках этой модели (или близких аналогов) ' +
    'верни ТОЛЬКО валидный JSON без markdown, со структурой:\n' +
    '{\n' +
    '  "brand": "бренд",\n' +
    '  "model": "модель",\n' +
    '  "energyClass": "A+++" или "A" и т.д.,\n' +
    '  "ratedWatts": число (пиковая/номинальная мощность в Вт),\n' +
    '  "annualKwh": число (годовое потребление кВт·ч по паспорту),\n' +
    '  "typicalHoursPerDay": число (типичные часы работы в сутки),\n' +
    '  "workloadFactors": [\n' +
    '    {"condition": "описание режима/нагрузки", "consumptionKwh": число, "unit": "стирка/сутки/час"}\n' +
    '  ],\n' +
    '  "description": "краткое описание 1-2 предложения",\n' +
    '  "confidence": "high" | "medium" | "low"\n' +
    '}\n' +
    'Если модель неизвестна — дай типичные характеристики для категории прибора и confidence "low".';

  const userPrompt = `Прибор: ${name || 'не указано'}. Модель: ${model || 'не указана'}. Найди энергохарактеристики.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  const data = await response.json();
  const text = (data.content || [])
    .map((block) => (block.type === 'text' ? block.text : ''))
    .filter(Boolean)
    .join('\n');

  const parsed = parseJsonFromText(text);
  if (!parsed) return null;

  return {
    brand: parsed.brand || null,
    model: parsed.model || model || null,
    energyClass: parsed.energyClass || '—',
    ratedWatts: Number(parsed.ratedWatts) || null,
    annualKwh: Number(parsed.annualKwh) || null,
    typicalHoursPerDay: Number(parsed.typicalHoursPerDay) || null,
    workloadFactors: Array.isArray(parsed.workloadFactors) ? parsed.workloadFactors : [],
    description: parsed.description || '',
    confidence: parsed.confidence || 'medium',
    source: 'llm',
  };
}

function compareWatts(label, userValue, specValue) {
  if (userValue == null || specValue == null || specValue <= 0) {
    return { label, userValue, specValue, diffPercent: null, level: 'unknown', text: null };
  }
  const diff = userValue - specValue;
  const diffPercent = Math.round((diff / specValue) * 100);
  const absPct = Math.abs(diffPercent);
  let level = 'ok';
  let text;
  if (absPct <= 15) {
    text = `${label}: ${userValue} Вт vs ${specValue} Вт по справочнику — совпадает (±${absPct}%).`;
  } else if (diff > 0) {
    level = 'warn';
    text = `${label}: ${userValue} Вт — на ${absPct}% выше справочника (${specValue} Вт). Возможно, завышена мощность в модели.`;
  } else {
    level = 'warn';
    text = `${label}: ${userValue} Вт — на ${absPct}% ниже справочника (${specValue} Вт). Возможно, прибор работает интенсивнее нормы.`;
  }
  return { label, userValue, specValue, diffPercent, level, text };
}

function buildComparison(specs, { userWatts, userHoursPerDay, ratedWatts, userReadings }) {
  const comparison = {
    modelVsSpec: compareWatts('Мощность в модели', userWatts, specs.ratedWatts),
    ratedVsSpec: compareWatts('По паспорту/квитанции', ratedWatts, specs.ratedWatts),
    userReadings: null,
    dailyModelKwh: null,
    dailySpecKwh: null,
  };

  if (userWatts && userHoursPerDay) {
    comparison.dailyModelKwh = Math.round(((userWatts * userHoursPerDay) / 1000) * 100) / 100;
  }
  if (specs.annualKwh) {
    comparison.dailySpecKwh = Math.round((specs.annualKwh / 365) * 100) / 100;
  } else if (specs.ratedWatts && specs.typicalHoursPerDay) {
    comparison.dailySpecKwh =
      Math.round(((specs.ratedWatts * specs.typicalHoursPerDay) / 1000) * 100) / 100;
  }

  if (userReadings && userReadings.dailyKwh != null && comparison.dailyModelKwh != null) {
    const share = Math.round((comparison.dailyModelKwh / userReadings.dailyKwh) * 1000) / 10;
    comparison.userReadings = {
      dailyKwh: userReadings.dailyKwh,
      weeklyKwh: userReadings.weeklyKwh,
      modelDailyKwh: comparison.dailyModelKwh,
      sharePercent: share,
      level: share > 50 ? 'warn' : share > 30 ? 'neutral' : 'ok',
      text:
        share > 50
          ? `Этот прибор в модели даёт ~${comparison.dailyModelKwh} кВт·ч/сут — это ${share}% от вашего фактического расхода (~${userReadings.dailyKwh} кВт·ч/сут по счётчику). Основной потребитель!`
          : share > 30
          ? `~${comparison.dailyModelKwh} кВт·ч/сут от прибора — ${share}% от фактических ${userReadings.dailyKwh} кВт·ч/сут по счётчику за неделю.`
          : `~${comparison.dailyModelKwh} кВт·ч/сут — умеренная доля (${share}%) от вашего расхода ${userReadings.dailyKwh} кВт·ч/сут.`,
    };
  }

  if (comparison.dailyModelKwh != null && comparison.dailySpecKwh != null) {
    const specDiff = comparison.dailyModelKwh - comparison.dailySpecKwh;
    comparison.modelVsSpecDaily = {
      modelKwh: comparison.dailyModelKwh,
      specKwh: comparison.dailySpecKwh,
      diffKwh: Math.round(specDiff * 100) / 100,
      level: Math.abs(specDiff) <= 0.3 ? 'ok' : 'warn',
      text:
        Math.abs(specDiff) <= 0.3
          ? `Суточный расход модели (~${comparison.dailyModelKwh} кВт·ч) близок к паспортному (~${comparison.dailySpecKwh} кВт·ч).`
          : specDiff > 0
          ? `Модель показывает ~${comparison.dailyModelKwh} кВт·ч/сут, паспорт — ~${comparison.dailySpecKwh} кВт·ч/сут (на ${specDiff.toFixed(1)} больше). Проверьте часы работы.`
          : `Модель ниже паспорта: ~${comparison.dailyModelKwh} vs ~${comparison.dailySpecKwh} кВт·ч/сут.`,
    };
  }

  return comparison;
}

function buildSummary(specs, comparison) {
  const parts = [];
  if (specs.energyClass && specs.energyClass !== '—') {
    parts.push(`Класс энергоэффективности: ${specs.energyClass}.`);
  }
  if (specs.annualKwh) {
    parts.push(`Годовое потребление: ~${specs.annualKwh} кВт·ч.`);
  }
  if (specs.description) parts.push(specs.description);
  if (comparison.modelVsSpec.text) parts.push(comparison.modelVsSpec.text);
  if (comparison.ratedVsSpec.text) parts.push(comparison.ratedVsSpec.text);
  if (comparison.userReadings && comparison.userReadings.text) {
    parts.push(comparison.userReadings.text);
  }
  return parts.join(' ');
}

/**
 * Ищет характеристики прибора и сравнивает с данными пользователя.
 */
async function lookupAppliance({ name, model, userWatts, userHoursPerDay, ratedWatts, userReadings }) {
  const trimmedModel = (model || '').trim();
  const trimmedName = (name || '').trim();

  if (!trimmedModel && !trimmedName) {
    return { found: false, error: 'Укажите название или модель прибора.' };
  }

  let specs = null;
  if (config.anthropicApiKey && trimmedModel) {
    try {
      specs = await llmLookup(trimmedName, trimmedModel);
    } catch (err) {
      console.error('Appliance LLM lookup failed:', err.message);
    }
  }

  if (!specs) {
    specs = fallbackLookup(trimmedName, trimmedModel);
  }

  const comparison = buildComparison(specs, {
    userWatts: userWatts != null ? Number(userWatts) : null,
    userHoursPerDay: userHoursPerDay != null ? Number(userHoursPerDay) : null,
    ratedWatts: ratedWatts != null ? Number(ratedWatts) : null,
    userReadings,
  });

  return {
    found: true,
    source: specs.source,
    confidence: specs.confidence || (specs.source === 'catalog' ? 'high' : 'low'),
    specs: {
      brand: specs.brand,
      model: specs.model,
      energyClass: specs.energyClass,
      ratedWatts: specs.ratedWatts,
      annualKwh: specs.annualKwh,
      typicalHoursPerDay: specs.typicalHoursPerDay,
      workloadFactors: specs.workloadFactors || [],
      description: specs.description,
    },
    comparison,
    summary: buildSummary(specs, comparison),
    aiEnabled: !!config.anthropicApiKey,
  };
}

module.exports = { lookupAppliance, findInCatalog, fallbackLookup };
