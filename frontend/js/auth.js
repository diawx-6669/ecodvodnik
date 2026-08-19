// Экран входа/регистрации + управление сессией пользователя.
// Публично наружу: window.appAuth = { user, isGuest, logout, requireGateThenInit }

const GUEST_FLAG_KEY = 'ecodvoinik_guest';

const AUDIENCE_LABELS = {
  household: { unitsQuestion: 'Сколько человек в семье?', typeLabel: 'дом' },
  school: { unitsQuestion: 'Сколько учеников в школе?', typeLabel: 'школа' },
  business: { unitsQuestion: 'Сколько сотрудников?', typeLabel: 'бизнес' },
};

const appAuth = {
  user: null,
  isGuest: false,
};

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-root').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-root').classList.remove('hidden');
}

function setAuthError(message) {
  const el = document.getElementById('auth-error');
  if (!message) {
    el.classList.remove('show');
    el.textContent = '';
    return;
  }
  el.textContent = message;
  el.classList.add('show');
}

function renderAccountChip() {
  const chip = document.getElementById('account-chip');
  const avatar = document.getElementById('account-avatar');
  const nameEl = document.getElementById('account-name');
  const typeEl = document.getElementById('account-type');
  chip.classList.remove('hidden');

  if (appAuth.user) {
    const name = appAuth.user.name || 'Пользователь';
    avatar.textContent = name.trim().charAt(0).toUpperCase() || 'U';
    nameEl.textContent = name;
    const info = AUDIENCE_LABELS[appAuth.user.type] || AUDIENCE_LABELS.household;
    const orgPart = appAuth.user.organizationName ? ` · ${appAuth.user.organizationName}` : '';
    typeEl.textContent = `${info.typeLabel}${orgPart} · ${appAuth.user.unitsCount}`;
  } else {
    avatar.textContent = 'Г';
    nameEl.textContent = 'Гость';
    typeEl.textContent = 'демо-режим, без аккаунта';
  }
}

// --- Переключение вкладок вход/регистрация ---
document.querySelectorAll('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    setAuthError(null);
    const target = tab.dataset.tab;
    document.getElementById('login-form').classList.toggle('hidden', target !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', target !== 'register');
  });
});

// --- Выбор типа аудитории при регистрации ---
document.querySelectorAll('.audience-option').forEach((opt) => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.audience-option').forEach((o) => o.classList.remove('active'));
    opt.classList.add('active');
    const type = opt.dataset.type;
    document.getElementById('register-type').value = type;
    document.getElementById('units-label').textContent = AUDIENCE_LABELS[type].unitsQuestion;
    document.getElementById('register-org').classList.toggle('hidden', type === 'household');
  });
});

// --- Вход ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setAuthError(null);
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = e.target.querySelector('.auth-submit');
  btn.disabled = true;
  try {
    const { token, user } = await api.login(email, password);
    setToken(token);
    appAuth.user = user;
    appAuth.isGuest = false;
    localStorage.removeItem(GUEST_FLAG_KEY);
    onAuthReady();
  } catch (err) {
    setAuthError(err.message || 'Не удалось войти');
  } finally {
    btn.disabled = false;
  }
});

// --- Регистрация ---
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setAuthError(null);
  const payload = {
    name: document.getElementById('register-name').value.trim(),
    email: document.getElementById('register-email').value.trim(),
    password: document.getElementById('register-password').value,
    type: document.getElementById('register-type').value,
    unitsCount: Number(document.getElementById('register-units').value) || 1,
    organizationName: document.getElementById('register-org').value.trim(),
  };
  const btn = e.target.querySelector('.auth-submit');
  btn.disabled = true;
  try {
    const { token, user } = await api.register(payload);
    setToken(token);
    appAuth.user = user;
    appAuth.isGuest = false;
    localStorage.removeItem(GUEST_FLAG_KEY);
    onAuthReady();
  } catch (err) {
    setAuthError(err.message || 'Не удалось зарегистрироваться');
  } finally {
    btn.disabled = false;
  }
});

// --- Гостевой доступ (демо без аккаунта) ---
document.getElementById('guest-btn').addEventListener('click', () => {
  setToken(null);
  appAuth.user = null;
  appAuth.isGuest = true;
  localStorage.setItem(GUEST_FLAG_KEY, '1');
  onAuthReady();
});

// --- Выход ---
document.getElementById('logout-btn').addEventListener('click', () => {
  setToken(null);
  localStorage.removeItem(GUEST_FLAG_KEY);
  appAuth.user = null;
  appAuth.isGuest = false;
  showAuthScreen();
});

// Вызывается после успешного входа/регистрации/выбора гостя —
// показывает приложение и запускает загрузку данных (определено в app.js)
function onAuthReady() {
  renderAccountChip();
  showApp();
  if (typeof window.initDashboard === 'function') window.initDashboard();
}

// Проверяем сохранённую сессию при загрузке страницы
async function bootstrapAuth() {
  const token = getToken();
  if (token) {
    try {
      const { user } = await api.me();
      appAuth.user = user;
      appAuth.isGuest = false;
      onAuthReady();
      return;
    } catch (err) {
      // токен протух/невалиден — сбрасываем и просим войти заново
      setToken(null);
    }
  }
  if (localStorage.getItem(GUEST_FLAG_KEY)) {
    appAuth.isGuest = true;
    onAuthReady();
    return;
  }
  showAuthScreen();
}

window.appAuth = appAuth;
bootstrapAuth();
