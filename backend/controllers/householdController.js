const { readDb, writeDb } = require('../data/db');
const { createHousehold } = require('../models/Household');
const { toPublicUser } = require('../models/User');

// POST /api/household  { name }
// Создаёт новое домохозяйство и делает текущего пользователя владельцем.
function create(req, res) {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (user.householdId) {
    return res.status(409).json({ error: 'Вы уже состоите в домохозяйстве. Сначала покиньте текущее.' });
  }

  const household = createHousehold({ name: req.body.name, ownerId: user.id });
  db.households.push(household);
  user.householdId = household.id;
  writeDb(db);

  return res.status(201).json({ household, user: toPublicUser(user) });
}

// POST /api/household/join  { inviteCode }
function join(req, res) {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'Укажите пригласительный код' });

  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (user.householdId) {
    return res.status(409).json({ error: 'Вы уже состоите в домохозяйстве. Сначала покиньте текущее.' });
  }

  const household = db.households.find(
    (h) => h.inviteCode === String(inviteCode).trim().toUpperCase()
  );
  if (!household) return res.status(404).json({ error: 'Домохозяйство с таким кодом не найдено' });

  household.memberIds.push(user.id);
  user.householdId = household.id;
  writeDb(db);

  return res.json({ household, user: toPublicUser(user) });
}

// GET /api/household — текущее домохозяйство пользователя + участники
function get(req, res) {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user || !user.householdId) {
    return res.json({ household: null, members: [] });
  }

  const household = db.households.find((h) => h.id === user.householdId);
  if (!household) return res.json({ household: null, members: [] });

  const members = db.users
    .filter((u) => household.memberIds.includes(u.id))
    .map((u) => toPublicUser(u));

  return res.json({ household, members });
}

// POST /api/household/leave
function leave(req, res) {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user || !user.householdId) {
    return res.status(400).json({ error: 'Вы не состоите в домохозяйстве' });
  }

  const household = db.households.find((h) => h.id === user.householdId);
  if (household) {
    household.memberIds = household.memberIds.filter((id) => id !== user.id);
    // Если владелец ушёл, а домохозяйство ещё не пустое — передаём владение
    // следующему участнику, чтобы домохозяйство не осталось "бесхозным".
    if (household.ownerId === user.id && household.memberIds.length > 0) {
      household.ownerId = household.memberIds[0];
    }
    // Пустые домохозяйства оставляем в базе (история), но это не критично.
  }
  user.householdId = null;
  writeDb(db);

  return res.json({ user: toPublicUser(user) });
}

module.exports = { create, join, get, leave };
