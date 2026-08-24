// Главная логика фронтенда: загрузка данных, обновление дашборда, чат с питомцем,
// живой статус подключённого устройства/счётчика и имя питомца.

async function loadDashboard() {
  try {
    const { summary, pet } = await api.getSummary();
    renderSummary(summary);
    renderPetState(pet);

    const { recommendations } = await api.getRecommendations();
    renderRecommendations(recommendations);
  } catch (err) {
    console.error('Не удалось загрузить дашборд:', err);
  }
}

function renderSummary(summary) {
  document.getElementById('water-total').textContent = `${summary.water.total_liters} л`;
  document.getElementById('water-cost').textContent = `${summary.water.cost_kzt} ₸`;

  document.getElementById('electricity-total').textContent = `${summary.electricity.total_kwh} кВт·ч`;
  document.getElementById('electricity-cost').textContent = `${summary.electricity.cost_kzt} ₸`;

  document.getElementById('total-cost').textContent = `${summary.total_cost_kzt} ₸`;

  const waterTrend = formatTrend(summary.water.trend_percent);
  const elecTrend = formatTrend(summary.electricity.trend_percent);
  const waterTrendEl = document.getElementById('water-trend');
  const elecTrendEl = document.getElementById('electricity-trend');
  waterTrendEl.textContent = waterTrend.text;
  waterTrendEl.className = `card-trend ${waterTrend.cls}`.trim();
  elecTrendEl.textContent = elecTrend.text;
  elecTrendEl.className = `card-trend ${elecTrend.cls}`.trim();

  const anomaliesEl = document.getElementById('anomalies');
  anomaliesEl.innerHTML = '';
  summary.anomalies.forEach((a) => {
    const div = document.createElement('div');
    div.className = 'anomaly-item';
    div.textContent = a.message;
    anomaliesEl.appendChild(div);
  });
}

function renderRecommendations(recommendations) {
  const container = document.getElementById('recommendations');
  container.innerHTML = '';
  recommendations.forEach((rec) => {
    const div = document.createElement('div');
    div.className = 'recommendation-item';
    div.innerHTML = `
      <div class="rec-title">${rec.title}</div>
      <div class="rec-detail">${rec.detail}</div>
      <div class="rec-savings">Потенциальная экономия: ~${rec.estimated_savings_kzt_per_month} ₸/мес</div>
    `;
    container.appendChild(div);
  });
}

async function loadChatHistory() {
  try {
    const history = await api.getChatHistory();
    history.slice(-10).forEach((m) => appendChatMessage(m.from, m.text));
  } catch (err) {
    console.error('Не удалось загрузить историю чата:', err);
  }
}

// --- Живой статус устройства ---

function formatSecondsAgo(seconds) {
  if (seconds < 60) return `${seconds} сек назад`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ч назад`;
}

async function loadDeviceStatus() {
  const dot = document.getElementById('device-dot');
  const text = document.getElementById('device-status-text');

  try {
    const status = await api.getDeviceStatus();

    if (!status.lastReading) {
      dot.className = 'device-dot device-dot--none';
      text.textContent = 'Устройство ещё не подключалось — используются ручные/демо-данные';
      return;
    }

    const typeLabel = status.lastReading.type === 'water' ? 'воды' : 'электричества';

    if (status.connected) {
      dot.className = 'device-dot device-dot--online';
      text.textContent = `Датчик на связи — последнее показание ${typeLabel} ${formatSecondsAgo(status.secondsAgo)} (всего с устройства: ${status.totalReadingsFromDevice})`;
    } else {
      dot.className = 'device-dot device-dot--offline';
      text.textContent = `Датчик офлайн — последний раз выходил на связь ${formatSecondsAgo(status.secondsAgo)}`;
    }
  } catch (err) {
    dot.className = 'device-dot device-dot--none';
    text.textContent = 'Не удалось проверить статус устройства';
    console.error(err);
  }
}

// --- Имя питомца (хранится локально в браузере пользователя) ---

function petNameKey() {
  // Разные аккаунты на одном браузере не должны делить имя питомца между собой
  const user = window.appAuth && window.appAuth.user;
  return user ? `ecodvoinik_pet_name_${user.id}` : 'ecodvoinik_pet_name_guest';
}

function loadPetName() {
  document.getElementById('pet-name-text').textContent = localStorage.getItem(petNameKey()) || 'Эко';
}

document.getElementById('rename-pet-btn').addEventListener('click', () => {
  const key = petNameKey();
  const current = localStorage.getItem(key) || 'Эко';
  const name = prompt('Как назовём питомца?', current);
  if (name && name.trim()) {
    const trimmed = name.trim();
    localStorage.setItem(key, trimmed);
    document.getElementById('pet-name-text').textContent = trimmed;
    appendChatMessage('pet', `Теперь меня зовут ${trimmed}. Мне нравится!`);
  }
});

// --- Обработчики форм ---

document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  appendChatMessage('user', message);
  input.value = '';

  try {
    const { reply, pet } = await api.sendMessage(message);
    appendChatMessage('pet', reply);
    renderPetState(pet);
    if (typeof window.checkAndRenderAchievements === 'function') window.checkAndRenderAchievements();
  } catch (err) {
    appendChatMessage('pet', 'У меня что-то со связью... попробуй ещё раз.');
    console.error(err);
  }
});

document.getElementById('reading-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = document.getElementById('reading-type').value;
  const value = document.getElementById('reading-value').value;
  if (!value) return;

  try {
    await api.addReading(type, value);
    document.getElementById('reading-value').value = '';
    await loadDashboard();
    if (typeof window.refreshAfterReading === 'function') window.refreshAfterReading();
  } catch (err) {
    console.error('Не удалось добавить показание:', err);
  }
});

// --- Инициализация ---
// Раньше запускалось сразу при загрузке страницы. Теперь дашборд стартует
// только после того, как человек вошёл в аккаунт (или выбрал гостевой
// демо-режим) — это делает auth.js, вызывая window.initDashboard().
let dashboardIntervalsStarted = false;

function initDashboard() {
  loadPetName();
  loadDashboard();
  loadDeviceStatus();
  loadChatHistory();

  // Новые модули (история/графики, достижения, советы, уведомления) —
  // каждый регистрирует свою функцию на window, если подключён его файл.
  if (typeof window.loadHistoryChart === 'function') window.loadHistoryChart();
  if (typeof window.loadAchievements === 'function') window.loadAchievements();
  if (typeof window.loadTips === 'function') window.loadTips();
  if (typeof window.loadNotifications === 'function') window.loadNotifications();
  if (window.appAuth && window.appAuth.user && typeof window.loadGoalsAndProgress === 'function') {
    window.loadGoalsAndProgress();
    window.loadConsumptionSummary();
  }

  if (!dashboardIntervalsStarted) {
    dashboardIntervalsStarted = true;
    // Автообновление дашборда раз в 30 секунд (например, чтобы видеть данные с устройства)
    setInterval(loadDashboard, 30000);
    // Статус устройства обновляем чаще — это живой индикатор связи с железом
    setInterval(loadDeviceStatus, 10000);
    // Уведомления проверяем раз в минуту — новые аномалии не требуют мгновенной реакции
    setInterval(() => { if (typeof window.loadNotifications === 'function') window.loadNotifications(); }, 60000);
  }
}

// Вызывается после добавления нового показания — обновляет всё, что зависит
// от свежих данных (достижения могут открыться, уведомления могут появиться).
window.refreshAfterReading = function refreshAfterReading() {
  if (typeof window.loadHistoryChart === 'function') window.loadHistoryChart();
  if (typeof window.loadTips === 'function') window.loadTips();
  if (typeof window.loadNotifications === 'function') window.loadNotifications();
  if (typeof window.checkAndRenderAchievements === 'function') window.checkAndRenderAchievements();
  if (window.appAuth && window.appAuth.user && typeof window.loadGoalsAndProgress === 'function') {
    window.loadGoalsAndProgress();
    window.loadConsumptionSummary();
  }
};

window.initDashboard = initDashboard;
