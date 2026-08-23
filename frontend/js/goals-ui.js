// ===================== Цели по расходу + экспорт данных =====================
// Отрисовывает прогресс по целям (#goals-container), обрабатывает форму
// установки новой цели (#goal-input-form -> setNewGoal, вызывается из
// onsubmit в index.html) и кнопку экспорта CSV (onclick="exportDataAsCSV()"),
// плюс короткую сводку за месяц (#summary-container) над кнопкой экспорта.
// Использует window.goalsAPI из goals-api.js.

const GOALS_TYPE_LABEL = { water: 'Вода', electricity: 'Электричество' };
const GOALS_TYPE_UNIT = { water: 'л', electricity: 'кВт·ч' };

function goalsCurrentMonthYear() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

async function loadGoalsAndProgress() {
  const container = document.getElementById('goals-container');
  if (!container) return;

  try {
    const progress = await window.goalsAPI.getGoalProgress(goalsCurrentMonthYear());
    renderGoalsProgress(progress);
  } catch (err) {
    console.error('Ошибка при загрузке целей:', err);
    container.innerHTML = '<div class="goal-item">Не удалось загрузить цели — попробуйте обновить страницу.</div>';
  }
}

function renderGoalsProgress(progress) {
  const container = document.getElementById('goals-container');
  if (!container) return;

  if (!progress || !progress.length) {
    container.innerHTML = '<div class="goal-item">Целей на этот месяц пока нет — установите первую выше.</div>';
    return;
  }

  container.innerHTML = progress
    .map((goal) => {
      const label = GOALS_TYPE_LABEL[goal.type] || goal.type;
      const unit = GOALS_TYPE_UNIT[goal.type] || '';
      const percent = Math.min(100, Number(goal.percentageUsed) || 0);
      const statusText = goal.isExceeded
        ? `Превышено на ${goal.percentageOver}%`
        : `${goal.percentageUsed}% от цели`;

      return `
        <div class="goal-item ${goal.isExceeded ? 'exceeded' : ''}">
          <div class="goal-header">
            <span class="goal-icon ${goal.type}"></span>
            <span class="goal-title">${label}</span>
            <span class="goal-status">${goal.percentageUsed}%</span>
          </div>
          <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width: ${percent}%"></div>
          </div>
          <div class="goal-details">
            <span>${Math.round(goal.currentUsage)} / ${goal.targetValue} ${unit}</span>
            <span class="${goal.isExceeded ? 'exceeded-warn' : ''}">${goal.isExceeded ? statusText : ''}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

// Вызывается из onsubmit формы в index.html
async function setNewGoal() {
  const typeInput = document.getElementById('goal-type');
  const valueInput = document.getElementById('goal-value');
  if (!typeInput || !valueInput) return;

  const type = typeInput.value;
  const targetValue = Number(valueInput.value);

  if (!targetValue || targetValue <= 0) {
    alert('Укажите положительное целевое значение.');
    return;
  }

  try {
    await window.goalsAPI.setConsumptionGoal(type, targetValue, goalsCurrentMonthYear());
    valueInput.value = '';
    await loadGoalsAndProgress();
  } catch (err) {
    console.error('Ошибка при установке цели:', err);
    alert('Не удалось установить цель. Проверьте, что вы вошли в аккаунт, и попробуйте ещё раз.');
  }
}

// Вызывается из onclick кнопки в index.html
async function exportDataAsCSV() {
  const startInput = document.getElementById('export-start-date');
  const endInput = document.getElementById('export-end-date');
  const typeInput = document.getElementById('export-type');

  const startDate = startInput ? startInput.value : '';
  const endDate = endInput ? endInput.value : '';
  const type = typeInput ? typeInput.value : '';

  try {
    const blob = await window.goalsAPI.exportConsumptionDataAsCSV(startDate, endDate, type);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consumption_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Ошибка при экспорте CSV:', err);
    alert('Не удалось скачать отчёт. Проверьте, что вы вошли в аккаунт, и попробуйте ещё раз.');
  }
}

async function loadConsumptionSummary() {
  const container = document.getElementById('summary-container');
  if (!container) return;

  try {
    const summary = await window.goalsAPI.getConsumptionSummary(goalsCurrentMonthYear());
    container.innerHTML = `
      <div class="summary-line">
        За этот месяц: вода — ${summary.water.total_liters} л, электричество — ${summary.electricity.total_kwh} кВт·ч
        (${summary.water.reading_count + summary.electricity.reading_count} показаний) — это данные,
        которые попадут в CSV, если не менять диапазон дат выше.
      </div>
    `;
  } catch (err) {
    console.error('Ошибка при загрузке сводки:', err);
    container.innerHTML = '';
  }
}

function goalsUiInit() {
  const container = document.getElementById('goals-container');
  if (!container) return; // блока целей нет в DOM

  loadGoalsAndProgress();
  loadConsumptionSummary();
}

window.setNewGoal = setNewGoal;
window.exportDataAsCSV = exportDataAsCSV;
window.loadGoalsAndProgress = loadGoalsAndProgress;
window.loadConsumptionSummary = loadConsumptionSummary;

document.addEventListener('DOMContentLoaded', goalsUiInit);
