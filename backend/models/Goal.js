// Модель для целевых показателей потребления пользователя
// Пользователь может установить, сколько литров воды и кВт·ч электричества
// он планирует потребить в месяц, и система будет отслеживать прогресс

function createGoal({ userId, type, monthYear, targetValue, unit }) {
  return {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    type, // 'water' | 'electricity'
    monthYear, // YYYY-MM формат для уникальности
    targetValue: Number(targetValue), // целевое значение (л для воды, кВт·ч для электричества)
    unit: unit || (type === 'water' ? 'liters' : 'kwh'),
    createdAt: new Date().toISOString(),
  };
}

module.exports = { createGoal };
