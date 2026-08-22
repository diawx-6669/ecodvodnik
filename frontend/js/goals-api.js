// API методы для работы с целями потребления
async function setConsumptionGoal(type, targetValue, monthYear) {
  const response = await fetch('/api/goals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ type, targetValue, monthYear }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function getGoalsForMonth(monthYear) {
  const response = await fetch(`/api/goals?monthYear=${monthYear}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function getGoalProgress(monthYear) {
  const response = await fetch(`/api/goals/progress?monthYear=${monthYear}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

// API методы для работы с уведомлениями
async function getUserAlerts() {
  const response = await fetch('/api/alerts', {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function checkAndCreateAlerts() {
  const response = await fetch('/api/alerts/check', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function acknowledgeAlert(alertId) {
  const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

// API методы для экспорта данных
async function exportConsumptionDataAsCSV(startDate, endDate, type) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (type) params.append('type', type);

  const response = await fetch(`/api/export/csv?${params}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.blob();
}

async function getConsumptionSummary(monthYear) {
  const response = await fetch(
    `/api/export/summary${monthYear ? `?monthYear=${monthYear}` : ''}`,
    {
      headers: { 'Authorization': `Bearer ${getToken()}` },
    }
  );
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

// Сделаем функции доступными глобально
window.goalsAPI = {
  setConsumptionGoal,
  getGoalsForMonth,
  getGoalProgress,
  getUserAlerts,
  checkAndCreateAlerts,
  acknowledgeAlert,
  exportConsumptionDataAsCSV,
  getConsumptionSummary,
};

// Также экспортируем для CommonJS если нужно
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.goalsAPI;
}
