// Простой service worker: кэширует статическую оболочку приложения
// (HTML/CSS/JS/иконки), чтобы приложение открывалось офлайн и как
// установленное PWA. Запросы к /api/... всегда идут в сеть — кэшировать
// динамические данные о расходе ресурсов не нужно и небезопасно (личные
// данные разных пользователей).

// ВАЖНО: при каждом деплое с изменениями во frontend увеличивайте версию
// (v1 -> v2 -> ...). Раньше кэш был cache-first с постоянным именем — из-за
// этого уже установленный на телефоне/в браузере service worker навсегда
// отдавал старые index.html/js/css из кэша, даже если в репозитории баг
// давно исправлен (именно поэтому фикс URL three.js и новая секция
// "Свет по солнцу" не появлялись на сайте у тестировщика). Теперь стратегия
// network-first: сначала пробуем сеть и обновляем кэш, а к кэшу обращаемся
// только как к запасному варианту (офлайн).
const CACHE_NAME = 'ecodvoinik-shell-v11';
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
  './css/address-map.css',
  './css/profile.css',
  './css/sun-schedule.css',
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
  './js/floorplan.js',
  './js/twin.js',
  './js/address-map.js',
  './js/sun-schedule.js',
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

  // network-first: свежая версия всегда в приоритете, кэш — только офлайн-запасной вариант
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
