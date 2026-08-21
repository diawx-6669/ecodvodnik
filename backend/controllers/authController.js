const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readDb, writeDb } = require('../data/db');
const { createUser, toPublicUser, ALLOWED_TYPES } = require('../models/User');
const config = require('../config/config');

function signToken(user) {
  return jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register
async function register(req, res) {
  const { name, email, password, type, unitsCount, organizationName } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Поля name, email и password обязательны' });
  }
  if (!EMAIL_RE.test(String(email))) {
    return res.status(400).json({ error: 'Некорректный email' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  }
  if (type && !ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({ error: `type должен быть одним из: ${ALLOWED_TYPES.join(', ')}` });
  }

  const db = readDb();
  const emailNormalized = String(email).toLowerCase().trim();
  const exists = db.users.some((u) => u.email === emailNormalized);
  if (exists) {
    return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = createUser({
    name,
    email: emailNormalized,
    passwordHash,
    type,
    unitsCount,
    organizationName,
  });

  db.users.push(user);
  writeDb(db);

  const token = signToken(user);
  return res.status(201).json({ token, user: toPublicUser(user) });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Поля email и password обязательны' });
  }

  const db = readDb();
  const emailNormalized = String(email).toLowerCase().trim();
  const user = db.users.find((u) => u.email === emailNormalized);
  if (!user) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const passwordOk = await bcrypt.compare(String(password), user.passwordHash);
  if (!passwordOk) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const token = signToken(user);
  return res.json({ token, user: toPublicUser(user) });
}

// GET /api/auth/me (требует токен)
function me(req, res) {
  return res.json({ user: toPublicUser(req.user) });
}

// PATCH /api/auth/me (требует токен) — обновление профиля,
// например изменение числа жильцов/учеников/сотрудников
function updateMe(req, res) {
  const { name, unitsCount, organizationName, theme } = req.body;

  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  if (name) user.name = name;
  if (unitsCount !== undefined) user.unitsCount = Math.max(1, Number(unitsCount) || 1);
  if (organizationName !== undefined) user.organizationName = String(organizationName).trim();
  if (theme !== undefined && ['dark', 'light'].includes(theme)) user.theme = theme;

  writeDb(db);
  return res.json({ user: toPublicUser(user) });
}

// POST /api/auth/change-password (требует токен)
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Укажите текущий и новый пароль' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Новый пароль должен быть не короче 6 символов' });
  }

  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Текущий пароль указан неверно' });

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  writeDb(db);
  return res.json({ ok: true });
}

// POST /api/auth/admin-code (требует токен) — активация прав администратора
// по секретному коду. Код проверяется только на сервере.
function claimAdmin(req, res) {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Введите секретный код' });

  if (String(code).trim() !== config.adminCode) {
    return res.status(403).json({ error: 'Неверный секретный код' });
  }

  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  user.role = 'admin';
  writeDb(db);
  return res.json({ user: toPublicUser(user) });
}

module.exports = { register, login, me, updateMe, changePassword, claimAdmin };
