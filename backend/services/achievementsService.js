// Логика геймификации: проверяет условия каталога достижений (Achievement.js)
// на основе текущих данных пользователя и открывает новые, если условие
// выполнено и достижение ещё не было получено.

const { CATALOG, createUnlockRecord } = require('../models/Achievement');

function hasUnlocked(db, userId, achievementId) {
  return db.achievements.some((a) => a.userId === userId && a.achievementId === achievementId);
}

function unlock(db, userId, achievementId) {
  if (hasUnlocked(db, userId, achievementId)) return null;
  const record = createUnlockRecord({ userId, achievementId });
  db.achievements.push(record);
  return record;
}

/**
 * Проверяет все условия достижений для пользователя и открывает новые.
 * Возвращает список только что открытых достижений (с деталями из каталога).
 *
 * context:
 *  - readings: показания пользователя (все, не только за неделю)
 *  - summary: сводка из analyticsService.buildSummary
 *  - pet: { level, mood } из petStateService.computePetState
 *  - goals: цели пользователя
 *  - messagesCount: сколько сообщений пользователь отправил питомцу
 *  - hasHousehold: состоит ли в семейном аккаунте
 */
function checkAchievements(db, userId, context) {
  const { readings = [], summary, pet, goals = [], messagesCount = 0, hasHousehold = false, goalReached = false } = context;
  const newlyUnlocked = [];

  const tryUnlock = (id, condition) => {
    if (condition && !hasUnlocked(db, userId, id)) {
      const record = unlock(db, userId, id);
      if (record) newlyUnlocked.push({ ...CATALOG.find((c) => c.id === id), unlockedAt: record.unlockedAt });
    }
  };

  tryUnlock('first_reading', readings.length >= 1);
  tryUnlock('chatty', messagesCount >= 10);
  tryUnlock('family_started', hasHousehold);

  if (summary) {
    tryUnlock('week_no_anomaly', summary.anomalies.length === 0);
    const waterOk = summary.benchmark.water_vs_benchmark_percent <= 0;
    const energyOk = summary.benchmark.electricity_vs_benchmark_percent <= 0;
    tryUnlock('water_saver', waterOk);
    tryUnlock('energy_saver', energyOk);
    tryUnlock('eco_master', waterOk && energyOk);
  }

  if (pet) {
    tryUnlock('pet_level_5', pet.level >= 5);
    tryUnlock('pet_level_10', pet.level >= 10);
  }

  if (goals.length > 0) {
    tryUnlock('goal_setter', true);
  }
  tryUnlock('goal_reached', goalReached);

  return newlyUnlocked;
}

/**
 * Собирает полный список достижений с флагом unlocked/прогрессом для UI.
 */
function buildAchievementsView(db, userId) {
  const unlockedMap = new Map(
    db.achievements.filter((a) => a.userId === userId).map((a) => [a.achievementId, a.unlockedAt])
  );
  const totalXp = CATALOG.filter((c) => unlockedMap.has(c.id)).reduce((sum, c) => sum + c.xpReward, 0);

  return {
    achievements: CATALOG.map((c) => ({
      ...c,
      unlocked: unlockedMap.has(c.id),
      unlockedAt: unlockedMap.get(c.id) || null,
    })),
    unlockedCount: unlockedMap.size,
    totalCount: CATALOG.length,
    totalXp,
  };
}

module.exports = { checkAchievements, buildAchievementsView };
