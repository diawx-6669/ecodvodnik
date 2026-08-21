const { readDb, writeDb } = require('../data/db');
const analyticsService = require('../services/analyticsService');
const petStateService = require('../services/petStateService');
const achievementsService = require('../services/achievementsService');

function computeGoalReachedNearMonthEnd(db, userId) {
  const now = new Date();
  // Смотрим на достижение цели только во второй половине месяца — иначе
  // "цель достигнута" срабатывала бы уже 1-го числа при нулевом расходе.
  if (now.getDate() < 20) return false;

  const currentMonth = now.toISOString().slice(0, 7);
  const monthGoals = db.goals.filter((g) => g.userId === userId && g.monthYear === currentMonth);
  if (monthGoals.length === 0) return false;

  return monthGoals.some((goal) => {
    const monthRegex = new RegExp(`^${currentMonth}`);
    const usage = db.readings
      .filter((r) => r.userId === userId && r.type === goal.type && monthRegex.test(r.timestamp))
      .reduce((sum, r) => sum + r.value, 0);
    return usage > 0 && usage <= goal.targetValue;
  });
}

// GET /api/achievements — полный список (открытые + закрытые) + прогресс XP
function list(req, res) {
  const db = readDb();
  const view = achievementsService.buildAchievementsView(db, req.user.id);
  return res.json(view);
}

// POST /api/achievements/check — пересчитать условия и открыть новые
// достижения на основе текущих данных пользователя. Вызывается фронтендом
// после значимых действий (добавил показание, отправил сообщение и т.д.).
function check(req, res) {
  const db = readDb();
  const userReadings = db.readings.filter((r) => r.userId === req.user.id || !r.userId);
  const summary = analyticsService.buildSummary(userReadings, req.user, db.settings);
  const pet = petStateService.computePetState(summary);
  const goals = db.goals.filter((g) => g.userId === req.user.id);
  const messagesCount = db.messages.filter((m) => m.userId === req.user.id && m.from === 'user').length;
  const goalReached = computeGoalReachedNearMonthEnd(db, req.user.id);

  const newlyUnlocked = achievementsService.checkAchievements(db, req.user.id, {
    readings: userReadings,
    summary,
    pet,
    goals,
    messagesCount,
    hasHousehold: !!req.user.householdId,
    goalReached,
  });

  if (newlyUnlocked.length > 0) writeDb(db);

  const view = achievementsService.buildAchievementsView(db, req.user.id);
  return res.json({ newlyUnlocked, ...view });
}

module.exports = { list, check };
