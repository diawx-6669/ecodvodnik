// Интеграция с реальными данными: счётчики/умный дом.
//
// Честно об ограничениях: у нас нет доступа к конкретным облачным API
// производителей умных счётчиков (это отдельные договоры/SDK под каждый
// бренд). Вместо этого сделан универсальный webhook — любой скрипт,
// шлюз умного дома (Home Assistant, Node-RED, самописный мост к счётчику
// по Modbus/MQTT и т.п.) может присылать показания сюда по одному общему
// протоколу, используя персональный API-ключ пользователя.

const crypto = require('crypto');
const { readDb, writeDb } = require('../data/db');
const { createReading } = require('../models/Reading');
const { toPublicUser } = require('../models/User');

function generateApiKey() {
  return `eco_${crypto.randomBytes(20).toString('hex')}`;
}

// POST /api/integrations/api-key — сгенерировать/перегенерировать ключ
function issueApiKey(req, res) {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  user.integrationApiKey = generateApiKey();
  writeDb(db);

  return res.json({
    apiKey: user.integrationApiKey,
    webhookUrl: '/api/integrations/webhook',
    usage: {
      method: 'POST',
      headers: { 'X-Api-Key': user.integrationApiKey, 'Content-Type': 'application/json' },
      body: { type: 'water | electricity', value: 12.5, unit: 'liters | kwh (необязательно)' },
    },
  });
}

// GET /api/integrations — статус интеграции пользователя
function getStatus(req, res) {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  const readingsFromIntegration = db.readings.filter(
    (r) => r.userId === req.user.id && r.source === 'integration'
  );
  const last = readingsFromIntegration.sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  )[0];

  return res.json({
    connected: !!(user && user.integrationApiKey),
    apiKeySet: !!(user && user.integrationApiKey),
    totalReadingsFromIntegration: readingsFromIntegration.length,
    lastReading: last || null,
  });
}

// DELETE /api/integrations/api-key — отозвать ключ
function revokeApiKey(req, res) {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  user.integrationApiKey = null;
  writeDb(db);
  return res.json({ user: toPublicUser(user) });
}

// POST /api/integrations/webhook — публичный (без JWT) приём показаний
// от внешнего устройства/шлюза по API-ключу в заголовке X-Api-Key.
function webhook(req, res) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'Укажите заголовок X-Api-Key' });

  const db = readDb();
  const user = db.users.find((u) => u.integrationApiKey === apiKey);
  if (!user) return res.status(401).json({ error: 'Неверный API-ключ' });

  const { type, value, unit, timestamp } = req.body;
  if (!type || value === undefined) {
    return res.status(400).json({ error: 'Поля type и value обязательны' });
  }
  if (!['water', 'electricity'].includes(type)) {
    return res.status(400).json({ error: "type должен быть 'water' или 'electricity'" });
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 10000) {
    return res.status(400).json({ error: 'value должно быть числом от 0 до 10000' });
  }

  const reading = createReading({ type, value: numericValue, source: 'integration', unit, timestamp });
  reading.userId = user.id;
  db.readings.push(reading);
  writeDb(db);

  return res.status(201).json(reading);
}

module.exports = { issueApiKey, getStatus, revokeApiKey, webhook };
