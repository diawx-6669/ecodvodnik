// UI компоненты и логика для целей потребления, уведомлений и экспорта данных

async function loadGoalsAndProgress() {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const progress = await goalsAPI.getGoalProgress(currentMonth);

    const container = document.getElementById('goals-container');
    if (!container) return;

    container.innerHTML = '';

    if (progress.length === 0) {
      container.innerHTML = '<p class="text-muted">Нет установленных целей на этот месяц</p>';
      return;
    }

    progress.forEach((goal) => {
      const percentage = Math.min(100, Math.round(goal.percentageUsed));
      const statusClass = goal.isExceeded ? 'exceeded' : 'on-track';
      const icon = goal.isExceeded ? '⚠️' : '✓';

      const div = document.createElement('div');
      div.className = `goal-item ${statusClass}`;
      div.innerHTML = `
        <div class="goal-header">
          <span class="goal-icon">${icon}</span>
          <span class="goal-title">${goal.type === 'water' ? '💧 Вода' : '⚡ Электричество'}</span>
          <span class="goal-status">${goal.currentUsage}/${goal.targetValue} ${goal.unit}</span>
        </div>
        <div class="goal-progress-bar">
          <div class="goal-progress-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="goal-details">
          <span>${percentage}% использовано</span>
          ${goal.isExceeded ? `<span class="exceeded-warn">Превышено на ${goal.percentageOver}%</span>` : ''}
        </div>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Ошибка при загрузке целей:', err);
  }
}

async function setNewGoal() {
  const type = document.getElementById('goal-type')?.value;
  const targetValue = document.getElementById('goal-value')?.value;

  if (!type || !targetValue) {
    alert('Заполните все поля');
    return;
  }

  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    await goalsAPI.setConsumptionGoal(type, targetValue, currentMonth);
    alert('Цель установлена!');
    await loadGoalsAndProgress();
  } catch (err) {
    console.error('Ошибка при установке цели:', err);
    alert('Не удалось установить цель');
  }
}

async function loadAlerts() {
  try {
    const alerts = await goalsAPI.getUserAlerts();
    const container = document.getElementById('alerts-container');
    if (!container) return;

    container.innerHTML = '';

    if (alerts.length === 0) {
      container.innerHTML = '<p class="text-muted">Нет активных уведомлений</p>';
      return;
    }

    alerts.forEach((alert) => {
      const div = document.createElement('div');
      div.className = 'alert-item alert-warning';
      div.innerHTML = `
        <div class="alert-content">
          <span class="alert-icon">⚠️</span>
          <div class="alert-text">
            <p class="alert-message">${alert.message}</p>
            <small class="alert-detail">Текущее: ${alert.currentUsage} vs Лимит: ${alert.goalValue}</small>
          </div>
          <button class="btn-close" data-alert-id="${alert.id}">✕</button>
        </div>
      `;
      container.appendChild(div);

      const closeBtn = div.querySelector('.btn-close');
      closeBtn.addEventListener('click', async () => {
        try {
          await goalsAPI.acknowledgeAlert(alert.id);
          div.remove();
        } catch (err) {
          console.error('Ошибка при закрытии уведомления:', err);
        }
      });
    });
  } catch (err) {
    console.error('Ошибка при загрузке уведомлений:', err);
  }
}

async function checkAlertsAndRefresh() {
  try {
    await goalsAPI.checkAndCreateAlerts();
    await loadAlerts();
  } catch (err) {
    console.error('Ошибка при проверке уведомлений:', err);
  }
}

async function exportDataAsCSV() {
  try {
    const startDate = document.getElementById('export-start-date')?.value;
    const endDate = document.getElementById('export-end-date')?.value;
    const type = document.getElementById('export-type')?.value;

    const blob = await goalsAPI.exportConsumptionDataAsCSV(startDate, endDate, type);

    // Создаём ссылку для скачивания
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consumption_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Ошибка при экспорте данных:', err);
    alert('Не удалось экспортировать данные');
  }
}

async function loadConsumptionSummary() {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const summary = await goalsAPI.getConsumptionSummary(currentMonth);

    const container = document.getElementById('summary-container');
    if (!container) return;

    container.innerHTML = `
      <div class="summary-card">
        <h4>Сводка за ${currentMonth}</h4>
        <div class="summary-row">
          <span>💧 Вода:</span>
          <strong>${summary.water.total_liters} л</strong>
          <small>(${summary.water.reading_count} измерений)</small>
        </div>
        <div class="summary-row">
          <span>⚡ Электричество:</span>
          <strong>${summary.electricity.total_kwh} кВт·ч</strong>
          <small>(${summary.electricity.reading_count} измерений)</small>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Ошибка при загрузке сводки:', err);
  }
}

// Инициализация при загрузке страницы
function initGoalsAndAlerts() {
  // Загружаем цели и уведомления при входе
  if (localStorage.getItem('token')) {
    loadGoalsAndProgress();
    checkAlertsAndRefresh();
    loadConsumptionSummary();

    // Проверяем уведомления каждые 5 минут
    setInterval(() => {
      checkAlertsAndRefresh();
    }, 5 * 60 * 1000);
  }
}

// Экспортируем функции (если используется модульная система)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadGoalsAndProgress,
    setNewGoal,
    loadAlerts,
    checkAlertsAndRefresh,
    exportDataAsCSV,
    loadConsumptionSummary,
    initGoalsAndAlerts,
  };
}
