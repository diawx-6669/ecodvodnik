// Расширенный аналитический сервис для анализа потребления
// Интегрируется с существующей аналитикой

async function generateSmartRecommendations(userType, currentUsage, targetUsage) {
  try {
    // Получаем рекомендации от AI сервиса (питомца)
    const response = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        message: `Пользователь (${userType}) потребил ${currentUsage} ресурса, лимит ${targetUsage}. 
                Дай 2-3 конкретных совета как сэкономить энергию/воду.`,
      }),
    });

    if (!response.ok) throw new Error('Failed to get AI recommendations');
    return response.json();
  } catch (err) {
    console.error('Error getting recommendations:', err);
    return { reply: 'Не удалось получить рекомендации' };
  }
}

// Анализ аномалий в потреблении
function analyzeConsumptionAnomaly(readings, resourceType, threshold = 1.5) {
  if (readings.length < 2) return [];

  const anomalies = [];
  const values = readings.map((r) => r.value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / values.length);

  readings.forEach((reading, idx) => {
    const zScore = Math.abs((reading.value - avg) / stdDev);
    if (zScore > threshold) {
      anomalies.push({
        timestamp: reading.timestamp,
        value: reading.value,
        deviation: ((reading.value - avg) / avg * 100).toFixed(1),
        severity: zScore > 3 ? 'high' : 'medium',
      });
    }
  });

  return anomalies;
}

// Выявление паттернов потребления (пики времени)
function identifyPeakHours(readings) {
  const hourlyUsage = {};

  readings.forEach((reading) => {
    const hour = new Date(reading.timestamp).getHours();
    hourlyUsage[hour] = (hourlyUsage[hour] || 0) + reading.value;
  });

  return Object.entries(hourlyUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour, usage]) => ({
      hour: `${hour}:00`,
      usage,
    }));
}

// Сравнение периодов (неделя, месяц, квартал)
async function comparePeriods(period1, period2) {
  try {
    const summary1 = await goalsAPI.getConsumptionSummary(period1);
    const summary2 = await goalsAPI.getConsumptionSummary(period2);

    const waterChange =
      ((summary1.water.total_liters - summary2.water.total_liters) / summary2.water.total_liters) * 100;
    const elecChange =
      ((summary1.electricity.total_kwh - summary2.electricity.total_kwh) /
        summary2.electricity.total_kwh) *
      100;

    return {
      water: {
        period1: summary1.water.total_liters,
        period2: summary2.water.total_liters,
        changePercent: waterChange.toFixed(1),
        trend: waterChange > 0 ? 'up' : 'down',
      },
      electricity: {
        period1: summary1.electricity.total_kwh,
        period2: summary2.electricity.total_kwh,
        changePercent: elecChange.toFixed(1),
        trend: elecChange > 0 ? 'up' : 'down',
      },
    };
  } catch (err) {
    console.error('Error comparing periods:', err);
    return null;
  }
}

// Расчет экономии денег потенциально
function calculatePotentialSavings(currentUsage, targetUsage, pricePerUnit) {
  if (currentUsage <= targetUsage) {
    return {
      status: 'Вы экономите',
      savings: ((targetUsage - currentUsage) * pricePerUnit).toFixed(0),
      percent: (((targetUsage - currentUsage) / targetUsage) * 100).toFixed(1),
    };
  } else {
    return {
      status: 'Можете сэкономить',
      savings: ((currentUsage - targetUsage) * pricePerUnit).toFixed(0),
      percent: (((currentUsage - targetUsage) / currentUsage) * 100).toFixed(1),
    };
  }
}

// Сделаем функции доступными глобально
window.generateSmartRecommendations = generateSmartRecommendations;
window.analyzeConsumptionAnomaly = analyzeConsumptionAnomaly;
window.identifyPeakHours = identifyPeakHours;
window.comparePeriods = comparePeriods;
window.calculatePotentialSavings = calculatePotentialSavings;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateSmartRecommendations,
    analyzeConsumptionAnomaly,
    identifyPeakHours,
    comparePeriods,
    calculatePotentialSavings,
  };
}
