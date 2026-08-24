// Структура одного показания.
// type: 'water' | 'electricity'
// source: 'device' | 'manual' | 'csv_import'
// value: число (литры для воды, кВт·ч для электричества) за период, либо накопительно

function createReading({ type, value, source = 'manual', unit, timestamp }) {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    value: Number(value),
    unit: unit || (type === 'water' ? 'liters' : 'kwh'),
    source,
    timestamp: timestamp || new Date().toISOString(),
  };
}

module.exports = { createReading };
