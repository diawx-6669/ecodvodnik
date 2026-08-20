const { readDb, writeDb } = require('../data/db');
const { createGoal } = require('../models/Goal');

// POST /api/goals
// Установить или обновить целевой показатель потребления на месяц
function setGoal(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }

  const { type, targetValue, monthYear } = req.body;

  if (!type || !['water', 'electricity'].includes(type)) {
    return res.status(400).json({ error: "type должен быть 'water' или 'electricity'" });
  }

  if (targetValue === undefined || Number(targetValue) <= 0) {
    return res.status(400).json({ error: 'targetValue должно быть положительным числом' });
  }

  if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) {
    return res.status(400).json({ error: 'monthYear должен быть в формате YYYY-MM' });
  }

  const db = readDb();
  
  // Проверяем, есть ли уже цель на этот месяц
  const existingGoalIndex = db.goals.findIndex(
    (g) => g.userId === req.user.id && g.type === type && g.monthYear === monthYear
  );

  let goal;
  if (existingGoalIndex !== -1) {
    // Обновляем существующую цель
    db.goals[existingGoalIndex].targetValue = Number(targetValue);
    goal = db.goals[existingGoalIndex];
  } else {
    // Создаём новую цель
    goal = createGoal({
      userId: req.user.id,
      type,
      monthYear,
      targetValue,
    });
    db.goals.push(goal);
  }

  writeDb(db);
  return res.json(goal);
}

// GET /api/goals?monthYear=2026-08
// Получить цели пользователя за конкретный месяц
function getGoals(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }

  const { monthYear } = req.query;
  const db = readDb();

  let goals = db.goals.filter((g) => g.userId === req.user.id);
  if (monthYear) {
    goals = goals.filter((g) => g.monthYear === monthYear);
  }

  return res.json(goals);
}

// GET /api/goals/progress?monthYear=2026-08
// Получить прогресс по целям с учётом реальных показаний
function getGoalProgress(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }

  const { monthYear } = req.query;
  if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) {
    return res.status(400).json({ error: 'monthYear обязателен и должен быть в формате YYYY-MM' });
  }

  const db = readDb();
  const goals = db.goals.filter((g) => g.userId === req.user.id && g.monthYear === monthYear);

  const progress = goals.map((goal) => {
    // Подсчитываем реальное потребление за месяц
    const monthRegex = new RegExp(`^${monthYear}`);
    const monthReadings = db.readings.filter(
      (r) => r.userId === req.user.id && r.type === goal.type && monthRegex.test(r.timestamp)
    );
    const currentUsage = monthReadings.reduce((sum, r) => sum + r.value, 0);

    return {
      ...goal,
      currentUsage,
      percentageUsed: ((currentUsage / goal.targetValue) * 100).toFixed(1),
      isExceeded: currentUsage > goal.targetValue,
      percentageOver: Math.max(
        0,
        (((currentUsage - goal.targetValue) / goal.targetValue) * 100).toFixed(1)
      ),
    };
  });

  return res.json(progress);
}

module.exports = { setGoal, getGoals, getGoalProgress };
