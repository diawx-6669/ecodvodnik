// Тесты используют свой собственный файл базы данных, чтобы не задеть
// реальный backend/data/db.json, если он есть при локальной разработке.
process.env.JWT_SECRET = 'test_secret_do_not_use_in_prod';
process.env.DEVICE_TOKEN = 'test_device_token';

const fs = require('fs');
const path = require('path');

const REAL_DB = path.join(__dirname, '..', 'data', 'db.json');
const BACKUP_DB = path.join(__dirname, '..', 'data', 'db.json.test-backup');

beforeAll(() => {
  if (fs.existsSync(REAL_DB)) {
    fs.copyFileSync(REAL_DB, BACKUP_DB);
  }
});

afterAll(() => {
  if (fs.existsSync(BACKUP_DB)) {
    fs.copyFileSync(BACKUP_DB, REAL_DB);
    fs.unlinkSync(BACKUP_DB);
  } else if (fs.existsSync(REAL_DB)) {
    fs.unlinkSync(REAL_DB);
  }
});

beforeEach(() => {
  const empty = { users: [], readings: [], messages: [] };
  fs.writeFileSync(REAL_DB, JSON.stringify(empty, null, 2));
});
