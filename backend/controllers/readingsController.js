const { readDb, writeDb } = require('../data/db');
const { createReading } = require('../models/Reading');
const config = require('../config/config');
const aiService = require('../services/aiService');

// POST /api/readings
// Принимает показания и от Arduino (по DEVICE_TOKEN), и с формы (ручной ввод).
function addReading(req, res) {
  const { type, value, source, token, unit, timestamp } = req.body;

  if (!type || value === undefined) {
    return res.status(400).json({ error: 'Поля type и value обязательны' });
  }
  if (!['water', 'electricity'].includes(type)) {
    return res.status(400).json({ error: "type должен быть 'water' или 'electricity'" });
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return res.status(400).json({ error: 'value должно быть неотрицательным числом' });
  }
  // Защита от опечаток/фрода: одно показание не может быть аномально огромным
  // (10 000 л воды или 10 000 кВт·ч за раз нереалистично для одного показания).
  if (numericValue > 10000) {
    return res.status(400).json({ error: 'value превышает допустимый лимит для одного показания (10000)' });
  }

  // Если запрос пришёл от устройства — простая проверка токена
  if (source === 'arduino' && token !== config.deviceToken) {
    return res.status(401).json({ error: 'Неверный device token' });
  }

  const reading = createReading({ type, value, source, unit, timestamp });
  // Если человек вошёл в аккаунт — привязываем показание к нему, чтобы
  // дом/школа/бизнес видели каждый свои данные, а не общий демо-поток.
  if (req.user) reading.userId = req.user.id;

  const db = readDb();
  db.readings.push(reading);
  writeDb(db);

  return res.status(201).json(reading);
}

// GET /api/readings
function listReadings(req, res) {
  const db = readDb();
  const { type, limit } = req.query;

  let readings = db.readings;
  // Показания без владельца (Arduino/демо) видны всем как общая демо-лента.
  // Показания конкретного аккаунта видит только он сам — гостю чужие
  // приватные данные (например, показания школы) не показываются.
  readings = req.user
    ? readings.filter((r) => !r.userId || r.userId === req.user.id)
    : readings.filter((r) => !r.userId);
  if (type) readings = readings.filter((r) => r.type === type);
  readings = readings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (limit) readings = readings.slice(0, Number(limit));

  return res.json(readings);
}

// POST /api/readings/import-csv (принимает уже распарсенный массив на бэкенде,
// сам парсинг CSV делается в scripts/generate_sample_data.py или на фронте)
function importReadings(req, res) {
  const { readings } = req.body;
  if (!Array.isArray(readings)) {
    return res.status(400).json({ error: 'Ожидается массив readings' });
  }

  const valid = readings.filter((r) => {
    const v = Number(r.value);
    return ['water', 'electricity'].includes(r.type) && Number.isFinite(v) && v >= 0 && v <= 10000;
  });
  const skipped = readings.length - valid.length;

  const db = readDb();
  const created = valid.map((r) => {
    const reading = createReading({ ...r, source: 'csv_import' });
    if (req.user) reading.userId = req.user.id;
    return reading;
  });
  db.readings.push(...created);
  writeDb(db);

  return res.status(201).json({ imported: created.length, skipped });
}

// POST /api/readings/photo-analyze
// Принимает фото счётчика или квитанции (data URL, base64) и возвращает
// распознанные ИИ данные (тип ресурса, показание, и т.д.) — показание при
// этом НЕ сохраняется автоматически, пользователь подтверждает его на форме.
async function analyzePhoto(req, res) {
  const { image } = req.body;
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Поле image обязательно (data URL с base64-фото)' });
  }

  const result = await aiService.analyzeMeterPhoto(image);
  if (!result.ok) {
    return res.status(422).json({ error: result.error });
  }

  return res.json(result.data);
}

module.exports = { addReading, listReadings, importReadings, analyzePhoto };
