// Простой service worker: кэширует статическую оболочку приложения
// (HTML/CSS/JS/иконки), чтобы приложение открывалось офлайн и как
// установленное PWA. Запросы к /api/... всегда идут в сеть — кэшировать
// динамические данные о расходе ресурсов не нужно и небезопасно (личные
// данные разных пользователей).

const CACHE_NAME = 'ecodvoinik-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/theme.css',
  './css/dashboard-extra.css',
  './css/goals.css',
  './css/twin.css',
  './css/floorplan.css',
  './css/profile.css',
  './js/api.js',
  './js/auth.js',
  './js/theme.js',
  './js/pet.js',
  './js/chart.js',
  './js/consumption-utils.js',
  './js/analytics-advanced.js',
  './js/history-chart.js',
  './js/achievements.js',
  './js/tips.js',
  './js/notifications.js',
  './js/household.js',
  './js/integrations.js',
  './js/goals-api.js',
  './js/goals-ui.js',
  './js/app.js',
  './js/profile.js',
  './js/admin-panel.js',
  './assets/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {
      // Если какой-то файл недоступен (например, при разработке) — не роняем установку
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Никогда не кэшируем API — там живые персональные данные
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
