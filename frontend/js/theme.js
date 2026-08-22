// Переключатель тёмной/светлой темы. Мгновенное применение (без "мигания")
// делает инлайн-скрипт в <head> (см. index.html) — здесь только UI-логика
// кнопки и синхронизация с сервером для вошедших пользователей.

const THEME_KEY = 'ecodvoinik_theme';

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

function applyTheme(theme) {
  const safe = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', safe);
  localStorage.setItem(THEME_KEY, safe);
}

function toggleTheme() {
  const next = getStoredTheme() === 'light' ? 'dark' : 'light';
  applyTheme(next);
  // Если человек вошёл в аккаунт — сохраняем выбор темы и на сервере,
  // чтобы она подхватывалась и на других устройствах.
  if (window.appAuth && window.appAuth.user && typeof api !== 'undefined') {
    api.updateMe({ theme: next }).catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getStoredTheme());
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.addEventListener('click', toggleTheme);
});

// После входа в аккаунт применяем сохранённую на сервере тему пользователя
// (если она отличается от локальной — например, первый вход с этого устройства).
window.applyUserTheme = function applyUserTheme(user) {
  if (user && user.theme) applyTheme(user.theme);
};
