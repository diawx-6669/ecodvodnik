const { readDb } = require('../data/db');
const analyticsService = require('../services/analyticsService');
const petStateService = require('../services/petStateService');

// GET /api/analytics/summary
function getSummary(req, res) {
  const db = readDb();
  // Вошедший пользователь видит свои показания + общие (Arduino/демо без
  // владельца). Гость — только общие, чужие приватные данные не показываем.
  const readings = req.user
    ? db.readings.filter((r) => !r.userId || r.userId === req.user.id)
    : db.readings.filter((r) => !r.userId);

  const summary = analyticsService.buildSummary(readings, req.user);
  const petState = petStateService.computePetState(summary);

  return res.json({ summary, pet: petState });
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

module.exports = { getSummary, getDeviceStatus };
