const { readDb, writeDb } = require('../data/db');
const { createReading } = require('../models/Reading');
const config = require('../config/config');

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

  // Если запрос пришёл от устройства — простая проверка токена
  if (source === 'arduino' && token !== config.deviceToken) {
    return res.status(401).json({ error: 'Неверный device token' });
  }

  const reading = createReading({ type, value, source, unit, timestamp });

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

  const db = readDb();
  const created = readings.map((r) => createReading({ ...r, source: 'csv_import' }));
  db.readings.push(...created);
  writeDb(db);

  return res.status(201).json({ imported: created.length });
}

module.exports = { addReading, listReadings, importReadings };
