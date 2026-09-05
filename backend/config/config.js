require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  isProduction: process.env.NODE_ENV === 'production',
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  groqApiKey: process.env.GROQ_API_KEY || null,
  // Значения справа от || — ТОЛЬКО для локальной разработки (чтобы
  // `npm test`/`npm start` работали сразу, без .env). В проде обязательно
  // задавайте свои через переменные окружения — см. render.yaml и
  // предупреждение при старте в server.js, которое ловит как раз случай,
  // когда эти дефолты случайно попали в продакшн.
  deviceToken: process.env.DEVICE_TOKEN || 'change_me_please',

  // Секрет для подписи JWT-токенов авторизации. В проде — обязательно
  // задавать свой длинный случайный секрет через переменную окружения.
  jwtSecret: process.env.JWT_SECRET || 'dev_insecure_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',

  // Секретный код, который пользователь вводит в своём профиле, чтобы
  // получить права администратора. В проде задайте свой через ADMIN_CODE.
  adminCode: process.env.ADMIN_CODE || 'DIAWX7',

  // Примерные тарифы по Казахстану (KZT). Поменяйте под свой регион/питч.
  tariffs: {
    water_kzt_per_liter: 0.35,      // тенге за литр воды
    electricity_kzt_per_kwh: 25.0,  // тенге за кВт·ч
  },

  // Средние нормативы потребления для сравнения — отдельно для каждого типа
  // аудитории сайта: жилые дома, школы и малый бизнес. "unit" — за что
  // считается норматив (человек / ученик / сотрудник), чтобы корректно
  // умножать на размер household/organization пользователя.
  benchmarks: {
    household: {
      label: 'на человека в семье',
      water_liters_per_unit_per_day: 150,
      electricity_kwh_per_unit_per_day: 2.5,
    },
    school: {
      label: 'на ученика',
      water_liters_per_unit_per_day: 20,
      electricity_kwh_per_unit_per_day: 0.6,
    },
    business: {
      label: 'на сотрудника',
      water_liters_per_unit_per_day: 40,
      electricity_kwh_per_unit_per_day: 3.2,
    },
  },
};
