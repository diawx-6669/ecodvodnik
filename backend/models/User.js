// Модель пользователя. Аудитория сайта — не только жилые дома, но и школы
// и малый бизнес, поэтому у аккаунта есть тип (type) и "размер" (unitsCount),
// который бэкенд использует для персональных нормативов и рекомендаций:
//   household -> количество человек в семье
//   school    -> количество учеников
//   business  -> количество сотрудников

const ALLOWED_TYPES = ['household', 'school', 'business'];

function createUser({ name, email, passwordHash, type = 'household', unitsCount = 1, organizationName = '' }) {
  return {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    type: ALLOWED_TYPES.includes(type) ? type : 'household',
    // Для дома — число жильцов, для школы — число учеников, для бизнеса — сотрудников
    unitsCount: Math.max(1, Number(unitsCount) || 1),
    // Название школы/компании (необязательно, для домов не используется)
    organizationName: organizationName ? String(organizationName).trim() : '',
    // 'user' | 'admin'. Админ получает доступ к просмотру всех эмоций питомца.
    role: 'user',
    createdAt: new Date().toISOString(),
  };
}

// Убирает приватные поля (хеш пароля) перед отправкой на фронтенд
function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash, ...publicUser } = user;
  // У аккаунтов, созданных до появления ролей, поля role нет
  publicUser.role = user.role === 'admin' ? 'admin' : 'user';
  return publicUser;
}

module.exports = { createUser, toPublicUser, ALLOWED_TYPES };
