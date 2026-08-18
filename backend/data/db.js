// Простейшая "база данных" на файле JSON.
// Для хакатона этого достаточно — не нужно поднимать отдельный сервер БД.
// При желании легко заменить на MongoDB/PostgreSQL, не меняя controllers/routes.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { readings: [], messages: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { readings: [], messages: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb };
