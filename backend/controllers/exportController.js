const { readDb } = require('../data/db');

// GET /api/export/csv?startDate=2026-01-01&endDate=2026-12-31&type=water
// Экспортировать показания в CSV формат
function exportToCSV(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }

  const { startDate, endDate, type } = req.query;
  const db = readDb();

  let readings = db.readings.filter((r) => r.userId === req.user.id);

  if (startDate) {
    const start = new Date(startDate);
    readings = readings.filter((r) => new Date(r.timestamp) >= start);
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    readings = readings.filter((r) => new Date(r.timestamp) <= end);
  }

  if (type && ['water', 'electricity'].includes(type)) {
    readings = readings.filter((r) => r.type === type);
  }

  // Сортируем по дате
  readings = readings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Формируем CSV
  const headers = ['Дата и время', 'Тип ресурса', 'Значение', 'Единица', 'Источник'];
  const rows = readings.map((r) => [
    new Date(r.timestamp).toLocaleString('ru-RU'),
    r.type === 'water' ? 'Вода' : 'Электричество',
    r.value,
    r.unit === 'liters' ? 'л' : 'кВт·ч',
    r.source === 'device' ? 'Устройство' : r.source === 'csv_import' ? 'CSV импорт' : 'Ручной ввод',
  ]);

  // Добавляем итоговую строку
  const totalWater = readings.filter((r) => r.type === 'water').reduce((sum, r) => sum + r.value, 0);
  const totalElectricity = readings
    .filter((r) => r.type === 'electricity')
    .reduce((sum, r) => sum + r.value, 0);

  rows.push(['', '', '', '', '']);
  rows.push(['ИТОГО:', '', '', '', '']);
  if (totalWater > 0) rows.push(['', 'Вода', totalWater, 'л', '']);
  if (totalElectricity > 0) rows.push(['', 'Электричество', totalElectricity, 'кВт·ч', '']);

  // Экранируем кавычки и заключаем в кавычки если содержит запятую
  const escapedRows = rows.map((row) =>
    row
      .map((cell) => {
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      })
      .join(',')
  );

  const csv = [headers.join(','), ...escapedRows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="consumption_${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.send(csv);
}

// GET /api/export/summary
// Получить сводку по потреблению за период (JSON)
function getConsumptionSummary(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }

  const { monthYear } = req.query;
  const db = readDb();

  let readings = db.readings.filter((r) => r.userId === req.user.id);

  if (monthYear && /^\d{4}-\d{2}$/.test(monthYear)) {
    const monthRegex = new RegExp(`^${monthYear}`);
    readings = readings.filter((r) => monthRegex.test(r.timestamp));
  }

  const waterReadings = readings.filter((r) => r.type === 'water');
  const electricityReadings = readings.filter((r) => r.type === 'electricity');

  const totalWater = waterReadings.reduce((sum, r) => sum + r.value, 0);
  const totalElectricity = electricityReadings.reduce((sum, r) => sum + r.value, 0);

  const avgWaterPerDay = waterReadings.length > 0 ? (totalWater / waterReadings.length).toFixed(2) : 0;
  const avgElectricityPerDay =
    electricityReadings.length > 0 ? (totalElectricity / electricityReadings.length).toFixed(2) : 0;

  return res.json({
    period: monthYear || 'all',
    water: {
      total_liters: totalWater.toFixed(2),
      reading_count: waterReadings.length,
      avg_per_reading: avgWaterPerDay,
    },
    electricity: {
      total_kwh: totalElectricity.toFixed(2),
      reading_count: electricityReadings.length,
      avg_per_reading: avgElectricityPerDay,
    },
  });
}

module.exports = { exportToCSV, getConsumptionSummary };
