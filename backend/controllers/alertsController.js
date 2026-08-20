const { readDb, writeDb } = require('../data/db');
const { createAlert } = require('../models/Alert');

// POST /api/alerts/check
// Проверить, не превышены ли установленные лимиты
// и создать уведомления если нужно
function checkAndCreateAlerts(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }

  const db = readDb();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Получаем цели пользователя на текущий месяц
  const monthGoals = db.goals.filter(
    (g) => g.userId === req.user.id && g.monthYear === currentMonth
  );

  const newAlerts = [];

  monthGoals.forEach((goal) => {
    // Подсчитываем потребление за месяц
    const monthRegex = new RegExp(`^${currentMonth}`);
    const monthReadings = db.readings.filter(
      (r) => r.userId === req.user.id && r.type === goal.type && monthRegex.test(r.timestamp)
    );
    const currentUsage = monthReadings.reduce((sum, r) => sum + r.value, 0);

    // Если превышена норма и уведомления за этот месяц нет
    if (currentUsage > goal.targetValue) {
      const existingAlert = db.alerts.find(
        (a) =>
          a.userId === req.user.id &&
          a.type === goal.type &&
          a.month === currentMonth &&
          !a.acknowledged
      );

      if (!existingAlert) {
        const percentageOver = (((currentUsage - goal.targetValue) / goal.targetValue) * 100).toFixed(1);
        const alert = createAlert({
          userId: req.user.id,
          type: goal.type,
          month: currentMonth,
          currentUsage,
          goalValue: goal.targetValue,
          percentageOver,
        });
        db.alerts.push(alert);
        newAlerts.push(alert);
      }
    }
  });

  writeDb(db);
  return res.json(newAlerts);
}

// GET /api/alerts
// Получить все неподтвержденные уведомления пользователя
function getUserAlerts(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }

  const db = readDb();
  const alerts = db.alerts
    .filter((a) => a.userId === req.user.id && !a.acknowledged)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.json(alerts);
}

// PUT /api/alerts/:alertId/acknowledge
// Отметить уведомление как прочитанное
function acknowledgeAlert(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }

  const { alertId } = req.params;
  const db = readDb();

  const alert = db.alerts.find(
    (a) => a.id === alertId && a.userId === req.user.id
  );

  if (!alert) {
    return res.status(404).json({ error: 'Уведомление не найдено' });
  }

  alert.acknowledged = true;
  writeDb(db);

  return res.json(alert);
}

module.exports = { checkAndCreateAlerts, getUserAlerts, acknowledgeAlert };
