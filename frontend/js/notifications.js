// Колокольчик уведомлений: показывает алерты о превышении цели по расходу
// (backend/controllers/alertsController.js). Раз в минуту опрашивает сервер
// на новые алерты (checkAlerts пересчитывает условия против целей пользователя).

function formatAlertTime(iso) {
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    return '';
  }
}

function renderNotifications(alerts) {
  const badge = document.getElementById('notif-badge');
  const list = document.getElementById('notif-list');
  const empty = document.getElementById('notif-empty');
  if (!list) return;

  if (badge) {
    if (alerts.length > 0) {
      badge.textContent = alerts.length > 9 ? '9+' : String(alerts.length);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (empty) empty.classList.toggle('hidden', alerts.length > 0);

  list.innerHTML = alerts
    .map((a) => `
      <div class="notif-item" data-id="${a.id}">
        <div class="notif-item-icon notif-item-icon-${a.type}">${a.type === 'water' ? 'Вода' : 'Свет'}</div>
        <div class="notif-item-body">
          <div class="notif-item-text">${a.message}</div>
          <div class="notif-item-time">${formatAlertTime(a.createdAt)}</div>
        </div>
        <button type="button" class="notif-item-ack" title="Отметить как прочитанное">✓</button>
      </div>`)
    .join('');

  list.querySelectorAll('.notif-item-ack').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const item = e.target.closest('.notif-item');
      const id = item.dataset.id;
      try {
        await api.acknowledgeAlert(id);
        item.remove();
        loadNotifications();
      } catch (err) {
        console.error('Не удалось подтвердить уведомление:', err);
      }
    });
  });
}

async function loadNotifications() {
  if (!window.appAuth || !window.appAuth.user) return; // уведомления только для аккаунтов с целями
  try {
    await api.checkAlerts();
    const alerts = await api.getAlerts();
    renderNotifications(alerts);
  } catch (err) {
    // Гость/нет целей — тихо игнорируем
  }
}

function toggleNotifDropdown() {
  const dd = document.getElementById('notif-dropdown');
  if (dd) dd.classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', () => {
  const bell = document.getElementById('notif-bell');
  if (bell) bell.addEventListener('click', toggleNotifDropdown);
  document.addEventListener('click', (e) => {
    const dd = document.getElementById('notif-dropdown');
    const bellBtn = document.getElementById('notif-bell');
    if (dd && dd.classList.contains('open') && !dd.contains(e.target) && e.target !== bellBtn && !bellBtn.contains(e.target)) {
      dd.classList.remove('open');
    }
  });
});

window.loadNotifications = loadNotifications;
