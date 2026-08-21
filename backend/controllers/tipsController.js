const { readDb } = require('../data/db');
const analyticsService = require('../services/analyticsService');
const tipsService = require('../services/tipsService');

// GET /api/tips — персонализированные советы по экономии на основе
// текущей сводки потребления пользователя (доступно и гостю на демо-данных).
function getTips(req, res) {
  const db = readDb();
  const readings = req.user
    ? db.readings.filter((r) => !r.userId || r.userId === req.user.id)
    : db.readings.filter((r) => !r.userId);

  const summary = analyticsService.buildSummary(readings, req.user, db.settings);
  const tips = tipsService.buildTips(summary);

  return res.json({ tips });
}

module.exports = { getTips };
