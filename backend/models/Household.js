// Модель домохозяйства (семейный аккаунт).
// Несколько пользователей могут объединиться в одно домохозяйство по
// пригласительному коду и видеть общую сводку потребления/цели/достижения.

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createHousehold({ name, ownerId }) {
  return {
    id: `household_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name && String(name).trim() ? String(name).trim() : 'Моя семья',
    ownerId,
    inviteCode: generateInviteCode(),
    memberIds: [ownerId],
    createdAt: new Date().toISOString(),
  };
}

module.exports = { createHousehold, generateInviteCode };
