const { readDb } = require('../data/db');
const analyticsService = require('../services/analyticsService');
const petStateService = require('../services/petStateService');
const historyService = require('../services/historyService');

// GET /api/analytics/summary
function getSummary(req, res) {
  const db = readDb();
  // Вошедший пользователь видит свои показания + общие (Arduino/демо без
  // владельца). Гость — только общие, чужие приватные данные не показываем.
  // Пользователь в семейном аккаунте (households) видит также показания
  // остальных членов семьи — это и есть "общий" семейный расход.
  let readings;
  if (req.user) {
    const household = req.user.householdId
      ? db.households.find((h) => h.id === req.user.householdId)
      : null;
    const memberIds = household ? new Set(household.memberIds) : new Set([req.user.id]);
    readings = db.readings.filter((r) => !r.userId || memberIds.has(r.userId));
  } else {
    readings = db.readings.filter((r) => !r.userId);
  }

  const summary = analyticsService.buildSummary(readings, req.user, db.settings);
  const lastReading = readings.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  const petState = petStateService.computePetState(summary, {
    lastReadingTimestamp: lastReading ? lastReading.timestamp : null,
  });

  return res.json({ summary, pet: petState });
}

// GET /api/analytics/history?period=day|week|month
// Данные для графика "История и графики" — расход по дням/неделям/месяцам.
function getHistory(req, res) {
  const db = readDb();
  const period = ['day', 'week', 'month'].includes(req.query.period) ? req.query.period : 'day';

  const readings = req.user
    ? db.readings.filter((r) => !r.userId || r.userId === req.user.id)
    : db.readings.filter((r) => !r.userId);

  const history = historyService.buildHistory(readings, period);
  return res.json(history);
}

// GET /api/analytics/device-status
// Показывает, "жив" ли Arduino прямо сейчас — по времени последнего
// показания с source === 'arduino'. Нужно для честного и наглядного
// подтверждения, что сайт реально связан с железом, а не только с
// демо/ручными данными.
const DEVICE_ONLINE_WINDOW_MS = 90 * 1000; // считаем "онлайн", если данные пришли < 90 сек назад

function getDeviceStatus(req, res) {
  const db = readDb();
  const arduinoReadings = db.readings
    .filter((r) => r.source === 'arduino')
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (arduinoReadings.length === 0) {
    return res.json({
      connected: false,
      lastReading: null,
      secondsAgo: null,
      totalReadingsFromDevice: 0,
    });
  }

  const last = arduinoReadings[0];
  const secondsAgo = Math.round((Date.now() - new Date(last.timestamp).getTime()) / 1000);
  const connected = secondsAgo <= DEVICE_ONLINE_WINDOW_MS / 1000;

  return res.json({
    connected,
    lastReading: last,
    secondsAgo,
    totalReadingsFromDevice: arduinoReadings.length,
  });
}

module.exports = { getSummary, getHistory, getDeviceStatus };
