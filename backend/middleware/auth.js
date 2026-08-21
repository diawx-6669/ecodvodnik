// Middleware авторизации через JWT (Bearer-токен в заголовке Authorization).

const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { readDb } = require('../data/db');

function getTokenFromHeader(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) return token;
  return null;
}

function loadUserFromToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  const db = readDb();
  const user = db.users.find((u) => u.id === payload.id);
  return user || null;
}

// Требует валидный токен. Если его нет/он невалиден — 401.
function requireAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ error: 'Требуется вход в аккаунт' });
  }
  try {
    const user = loadUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Сессия истекла или токен недействителен' });
  }
}

// Не требует токен, но если он есть и валиден — подставляет req.user.
// Используется там, где сайт должен работать и для гостя (демо-режим),
// но персонализируется, если человек вошёл в аккаунт.
function optionalAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return next();
  try {
    const user = loadUserFromToken(token);
    if (user) req.user = user;
  } catch (err) {
    // Невалидный токен у "опционального" маршрута — просто игнорируем,
    // человек будет обработан как гость.
  }
  return next();
}

// Требует валидный токен И роль admin. Используется расширенной админкой
// (управление пользователями, глобальная статистика, пороги аномалий).
function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступно только администратору' });
    }
    return next();
  });
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
