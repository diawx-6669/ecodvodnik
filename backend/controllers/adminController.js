const { readDb, writeDb } = require('../data/db');
const { toPublicUser } = require('../models/User');

// GET /api/admin/users — список всех пользователей (для управления)
function listUsers(req, res) {
  const db = readDb();
  const users = db.users.map((u) => {
    const readingsCount = db.readings.filter((r) => r.userId === u.id).length;
    return { ...toPublicUser(u), readingsCount };
  });
  return res.json({ users });
}

// PUT /api/admin/users/:userId/role  { role: 'user' | 'admin' }
function setUserRole(req, res) {
  const { userId } = req.params;
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: "role должен быть 'user' или 'admin'" });
  }
  const db = readDb();
  const target = db.users.find((u) => u.id === userId);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

  target.role = role;
  writeDb(db);
  return res.json({ user: toPublicUser(target) });
}

// GET /api/admin/stats — глобальная статистика по всему сервису
function globalStats(req, res) {
  const db = readDb();
  const totalUsers = db.users.length;
  const byType = db.users.reduce((acc, u) => {
    acc[u.type] = (acc[u.type] || 0) + 1;
    return acc;
  }, {});

  const totalReadings = db.readings.length;
  const totalWaterLiters = Math.round(
    db.readings.filter((r) => r.type === 'water').reduce((sum, r) => sum + r.value, 0)
  );
  const totalElectricityKwh =
    Math.round(db.readings.filter((r) => r.type === 'electricity').reduce((sum, r) => sum + r.value, 0) * 10) / 10;

  const activeAlerts = db.alerts.filter((a) => !a.acknowledged).length;
  const householdsCount = db.households.length;
  const achievementsUnlocked = db.achievements.length;

  return res.json({
    totalUsers,
    usersByType: byType,
    totalReadings,
    totalWaterLiters,
    totalElectricityKwh,
    activeAlerts,
    householdsCount,
    achievementsUnlocked,
    settings: db.settings,
  });
}

// GET /api/admin/settings
function getSettings(req, res) {
  const db = readDb();
  return res.json(db.settings);
}

// PUT /api/admin/settings  { anomalyThresholdPercent, benchmarkOverThresholdPercent }
function updateSettings(req, res) {
  const { anomalyThresholdPercent, benchmarkOverThresholdPercent } = req.body;
  const db = readDb();

  if (anomalyThresholdPercent !== undefined) {
    const v = Number(anomalyThresholdPercent);
    if (!Number.isFinite(v) || v <= 0) return res.status(400).json({ error: 'anomalyThresholdPercent должен быть положительным числом' });
    db.settings.anomalyThresholdPercent = v;
  }
  if (benchmarkOverThresholdPercent !== undefined) {
    const v = Number(benchmarkOverThresholdPercent);
    if (!Number.isFinite(v) || v <= 0) return res.status(400).json({ error: 'benchmarkOverThresholdPercent должен быть положительным числом' });
    db.settings.benchmarkOverThresholdPercent = v;
  }

  writeDb(db);
  return res.json(db.settings);
}

module.exports = { listUsers, setUserRole, globalStats, getSettings, updateSettings };
