// Простейшая "база данных" на файле JSON.
// Для хакатона этого достаточно — не нужно поднимать отдельный сервер БД.
// При желании легко заменить на MongoDB/PostgreSQL, не меняя controllers/routes.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

const EMPTY_DB = () => ({
  users: [],
  readings: [],
  messages: [],
  goals: [],
  alerts: [],
  households: [],
  achievements: [],
  settings: {
    // Глобальные настройки, которые может менять только администратор
    anomalyThresholdPercent: 25, // при каком росте % относительно прошлой недели считаем аномалией
    benchmarkOverThresholdPercent: 40, // на сколько % выше норматива считаем аномалией
  },
});

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = EMPTY_DB();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    const data = JSON.parse(raw);
    // На случай базы, созданной старой версией (до появления новых разделов)
    const empty = EMPTY_DB();
    if (!data.users) data.users = empty.users;
    if (!data.readings) data.readings = empty.readings;
    if (!data.messages) data.messages = empty.messages;
    if (!data.goals) data.goals = empty.goals;
    if (!data.alerts) data.alerts = empty.alerts;
    if (!data.households) data.households = empty.households;
    if (!data.achievements) data.achievements = empty.achievements;
    if (!data.settings) data.settings = empty.settings;
    return data;
  } catch (e) {
    return EMPTY_DB();
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb };
