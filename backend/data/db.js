// Простейшая "база данных" на файле JSON.
// Для хакатона этого достаточно — не нужно поднимать отдельный сервер БД.
// При желании легко заменить на MongoDB/PostgreSQL, не меняя controllers/routes.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { users: [], readings: [], messages: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    const data = JSON.parse(raw);
    // На случай базы, созданной старой версией (до появления аккаунтов)
    if (!data.users) data.users = [];
    if (!data.readings) data.readings = [];
    if (!data.messages) data.messages = [];
    return data;
  } catch (e) {
    return { users: [], readings: [], messages: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb };
