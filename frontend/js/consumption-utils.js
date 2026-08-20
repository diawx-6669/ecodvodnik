// Утилиты для работы с потреблением ресурсов и расчётов

// Расчет стоимости потребления
function calculateCost(value, type, pricesPerUnit = {}) {
  const defaultPrices = {
    water: 50, // тенге за литр (средняя цена)
    electricity: 15, // тенге за кВт·ч
  };

  const price = pricesPerUnit[type] || defaultPrices[type];
  return (value * price).toFixed(2);
}

// Преобразование месячного потребления в дневное среднее
function monthlyToDailyAverage(monthlyValue, day = new Date().getDate()) {
  return (monthlyValue / day).toFixed(2);
}

// Прогноз потребления на конец месяца
function forecastMonthlyUsage(currentValue, currentDay = new Date().getDate()) {
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  return ((currentValue / currentDay) * daysInMonth).toFixed(2);
}

// Сравнение с предыдущим месяцем (простой расчет)
function calculateTrendPercent(currentMonth, previousMonth) {
  if (previousMonth === 0) return 0;
  const change = ((currentMonth - previousMonth) / previousMonth) * 100;
  return change.toFixed(1);
}

// Получить текущий месяц в формате YYYY-MM
function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

// Получить предыдущий месяц в формате YYYY-MM
function getPreviousMonth(monthOffset = 1) {
  const date = new Date();
  date.setMonth(date.getMonth() - monthOffset);
  return date.toISOString().slice(0, 7);
}

// Форматирование числа с разделителями
function formatNumber(num, decimals = 2) {
  return Number(num).toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Категоризация потребления (низкое, среднее, высокое)
function categorizeUsage(currentUsage, recommendedUsage) {
  const ratio = currentUsage / recommendedUsage;
  if (ratio <= 0.7) return { level: 'низкое', emoji: '🟢', color: '#22c55e' };
  if (ratio <= 1.0) return { level: 'среднее', emoji: '🟡', color: '#eab308' };
  return { level: 'высокое', emoji: '🔴', color: '#ef4444' };
}

// Рекомендуемые нормы потребления по типу аккаунта (на человека/студента/сотрудника в месяц)
function getRecommendedUsage(type, unitsCount = 1) {
  const recommendations = {
    household: {
      water: 45 * unitsCount, // л в день на человека
      electricity: 150 * unitsCount, // кВт·ч на человека
    },
    school: {
      water: 50 * unitsCount, // л в день на ученика
      electricity: 200 * unitsCount, // кВт·ч
    },
    business: {
      water: 60 * unitsCount, // л в день на сотрудника
      electricity: 250 * unitsCount, // кВт·ч
    },
  };

  return recommendations[type] || recommendations.household;
}

module.exports = {
  calculateCost,
  monthlyToDailyAverage,
  forecastMonthlyUsage,
  calculateTrendPercent,
  getCurrentMonth,
  getPreviousMonth,
  formatNumber,
  categorizeUsage,
  getRecommendedUsage,
};
