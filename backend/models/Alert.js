// Модель для уведомлений о превышении норм потребления
// Автоматически создаётся, когда потребление превышает установленный лимит

function createAlert({ userId, type, month, currentUsage, goalValue, percentageOver }) {
  return {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    type, // 'water' | 'electricity'
    month, // YYYY-MM
    currentUsage: Number(currentUsage),
    goalValue: Number(goalValue),
    percentageOver: Number(percentageOver), // на сколько % превышено
    message: `${type === 'water' ? 'Вода' : 'Электричество'}: вы превышили норму на ${percentageOver.toFixed(1)}%`,
    createdAt: new Date().toISOString(),
    acknowledged: false, // прочитал ли пользователь уведомление
  };
}

module.exports = { createAlert };
