// Каталог достижений/квестов для геймификации.
// unlockedAt-записи хранятся отдельно в db.achievements
// ({ userId, achievementId, unlockedAt }), сам каталог статичен.

const CATALOG = [
  {
    id: 'first_reading',
    title: 'Первый шаг',
    description: 'Добавьте первое показание расхода воды или электричества.',
    xpReward: 10,
  },
  {
    id: 'week_no_anomaly',
    title: 'Неделя без сюрпризов',
    description: 'Неделя подряд без аномалий расхода.',
    xpReward: 25,
  },
  {
    id: 'water_saver',
    title: 'Хранитель воды',
    description: 'Расход воды за неделю ниже норматива.',
    xpReward: 20,
  },
  {
    id: 'energy_saver',
    title: 'Хранитель энергии',
    description: 'Расход электричества за неделю ниже норматива.',
    xpReward: 20,
  },
  {
    id: 'eco_master',
    title: 'Эко-мастер',
    description: 'И вода, и электричество ниже норматива одновременно.',
    xpReward: 40,
  },
  {
    id: 'goal_setter',
    title: 'Целеустремлённый',
    description: 'Установите цель по расходу на месяц.',
    xpReward: 10,
  },
  {
    id: 'goal_reached',
    title: 'Цель достигнута',
    description: 'Уложитесь в установленную месячную цель.',
    xpReward: 35,
  },
  {
    id: 'pet_level_5',
    title: 'Питомец подрос',
    description: 'Питомец достиг 5 уровня.',
    xpReward: 15,
  },
  {
    id: 'pet_level_10',
    title: 'Питомец расцвёл',
    description: 'Питомец достиг максимального 10 уровня.',
    xpReward: 50,
  },
  {
    id: 'chatty',
    title: 'Лучшие друзья',
    description: 'Отправьте питомцу 10 сообщений в чате.',
    xpReward: 15,
  },
  {
    id: 'family_started',
    title: 'Вместе веселее',
    description: 'Создайте или присоединитесь к семейному аккаунту.',
    xpReward: 10,
  },
];

function createUnlockRecord({ userId, achievementId }) {
  return {
    id: `ach_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    achievementId,
    unlockedAt: new Date().toISOString(),
  };
}

module.exports = { CATALOG, createUnlockRecord };
