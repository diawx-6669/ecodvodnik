require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  deviceToken: process.env.DEVICE_TOKEN || 'change_me_please',

  // Примерные тарифы по Казахстану (KZT). Поменяйте под свой регион/питч.
  tariffs: {
    water_kzt_per_liter: 0.35,      // тенге за литр воды
    electricity_kzt_per_kwh: 25.0,  // тенге за кВт·ч
  },

  // Средние нормативы потребления для сравнения (демо-значения)
  benchmarks: {
    water_liters_per_person_per_day: 150,
    electricity_kwh_per_household_per_day: 8,
  },
};
