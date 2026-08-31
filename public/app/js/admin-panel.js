// Расширенная админка: глобальная статистика сервиса, список пользователей
// с управлением ролями, настройка порогов аномалий. Видна только тем, у
// кого role === 'admin' (см. profile.js: isAdmin()).

function adminEl(id) {
  return document.getElementById(id);
}

async function loadAdminExtras() {
  if (typeof isAdmin !== 'function' || !isAdmin()) return;

  try {
    const [stats, { users }, settings] = await Promise.all([
      api.adminGlobalStats(),
      api.adminListUsers(),
      api.adminGetSettings(),
    ]);
    renderAdminStats(stats);
    renderAdminUsers(users);
    renderAdminSettings(settings);
  } catch (err) {
    console.error('Не удалось загрузить админ-данные:', err);
  }
}

function renderAdminStats(stats) {
  const box = adminEl('admin-stats-grid');
  if (!box) return;
  const items = [
    ['Пользователей', stats.totalUsers],
    ['Показаний всего', stats.totalReadings],
    ['Воды суммарно', `${stats.totalWaterLiters} л`],
    ['Электричества суммарно', `${stats.totalElectricityKwh} кВт·ч`],
    ['Активных алертов', stats.activeAlerts],
    ['Домохозяйств', stats.householdsCount],
    ['Открыто достижений', stats.achievementsUnlocked],
  ];
  box.innerHTML = items
    .map(([label, value]) => `
      <div class="admin-stat-card">
        <div class="admin-stat-value">${value}</div>
        <div class="admin-stat-label">${label}</div>
      </div>`)
    .join('');
}

function renderAdminUsers(users) {
  const box = adminEl('admin-users-list');
  if (!box) return;
  box.innerHTML = users
    .map((u) => `
      <div class="profile-row admin-user-row">
        <span class="profile-row-label">${u.name} <span class="admin-user-email">${u.email}</span></span>
        <span class="profile-row-value">
          <select class="admin-role-select" data-user-id="${u.id}">
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
          </select>
        </span>
      </div>`)
    .join('');

  box.querySelectorAll('.admin-role-select').forEach((select) => {
    select.addEventListener('change', async (e) => {
      const userId = e.target.dataset.userId;
      const role = e.target.value;
      try {
        await api.adminSetUserRole(userId, role);
      } catch (err) {
        console.error('Не удалось изменить роль:', err);
        alert(err.message || 'Не удалось изменить роль пользователя');
      }
    });
  });
}

function renderAdminSettings(settings) {
  const anomalyInput = adminEl('admin-anomaly-threshold');
  const benchmarkInput = adminEl('admin-benchmark-threshold');
  if (anomalyInput) anomalyInput.value = settings.anomalyThresholdPercent;
  if (benchmarkInput) benchmarkInput.value = settings.benchmarkOverThresholdPercent;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = adminEl('admin-settings-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const anomalyThresholdPercent = Number(adminEl('admin-anomaly-threshold').value);
      const benchmarkOverThresholdPercent = Number(adminEl('admin-benchmark-threshold').value);
      const msg = adminEl('admin-settings-msg');
      try {
        await api.adminUpdateSettings({ anomalyThresholdPercent, benchmarkOverThresholdPercent });
        if (msg) { msg.textContent = 'Настройки сохранены'; msg.className = 'profile-msg show ok'; }
      } catch (err) {
        if (msg) { msg.textContent = err.message || 'Не удалось сохранить'; msg.className = 'profile-msg show err'; }
      }
    });
  }
});

window.loadAdminExtras = loadAdminExtras;
