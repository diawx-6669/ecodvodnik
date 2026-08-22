// ===================== Демо-данные потребления =====================
// Настоящий поток показаний идёт от Arduino (см. readingsController).
// Но у нового аккаунта показаний ещё нет, поэтому дашборд и аналитика
// показывают пустоту/прочерки, пока не подключено железо. Для демо/питча
// это выглядит "сломанным". Здесь — та же идея, что в
// scripts/generate_sample_data.py, но встроенная в бэкенд и привязанная
// к конкретному пользователю (его типу household/school/business и
// unitsCount), чтобы цифры сразу были правдоподобные и по казахстанским
// тарифам (config.tariffs), а сводка на дашборде и аналитика ниже
// совпадали — они обе считаются из одного и того же db.readings.

const config = require('../config/config');
const { createReading } = require('../models/Reading');

const HISTORY_DAYS = 45; // сколько дней истории генерируем при регистрации
const REFRESH_AFTER_HOURS = 20; // раз в столько часов "дописываем" новый день при заходе

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

// Дневная база потребления в зависимости от типа аккаунта и его размера,
// на основе тех же нормативов, что в config.benchmarks (с шумом ±15-20%,
// чтобы не было ровно на нормативе — реальные цифры всегда скачут).
function dailyBase(user) {
  const type = user && user.type && config.benchmarks[user.type] ? user.type : 'household';
  const bench = config.benchmarks[type];
  const units = Math.max(1, Number(user && user.unitsCount) || 1);

  return {
    water: bench.water_liters_per_unit_per_day * units,
    electricity: bench.electricity_kwh_per_unit_per_day * units,
  };
}

// Генерирует одно показание за конкретный день с реалистичным разбросом.
// dayIndexFromStart / totalDays — для лёгкого тренда (динамика для аналитики
// и трендов на дашборде тоже была не "ровной линией").
function buildDayReadings(userId, base, dateObj, dayIndexFromStart, totalDays) {
  const trend = 1 + (dayIndexFromStart / Math.max(1, totalDays)) * 0.12; // небольшой рост к "сегодня"
  const weekday = dateObj.getUTCDay();
  const weekendFactor = weekday === 0 || weekday === 6 ? 1.15 : 1; // чуть больше расхода в выходные

  const water = base.water * trend * weekendFactor * randomInRange(0.82, 1.18);
  const electricity = base.electricity * trend * weekendFactor * randomInRange(0.82, 1.18);

  const timestamp = new Date(Date.UTC(
    dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 18, 0, 0
  )).toISOString();

  const waterReading = createReading({
    type: 'water',
    value: Math.max(0, Math.round(water * 10) / 10),
    source: 'manual',
    unit: 'liters',
    timestamp,
  });
  waterReading.userId = userId;

  const electricityReading = createReading({
    type: 'electricity',
    value: Math.max(0, Math.round(electricity * 100) / 100),
    source: 'manual',
    unit: 'kwh',
    timestamp,
  });
  electricityReading.userId = userId;

  return [waterReading, electricityReading];
}

// Вызывается сразу после регистрации: заполняет HISTORY_DAYS дней истории,
// чтобы недельные/месячные графики и сводка сразу были осмысленными.
function seedInitialHistory(user) {
  const base = dailyBase(user);
  const readings = [];
  const today = new Date();

  for (let i = HISTORY_DAYS - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    const dayIndexFromStart = HISTORY_DAYS - 1 - i;
    readings.push(...buildDayReadings(user.id, base, date, dayIndexFromStart, HISTORY_DAYS));
  }

  return readings;
}

// Вызывается при логине: если у пользователя последнее показание старше
// REFRESH_AFTER_HOURS часов — "дописывает" одно новое показание за сегодня,
// чтобы при повторном заходе цифры на дашборде отличались от прошлого раза
// (как будто реально что-то поступило с устройства/введено вручную).
function maybeAppendToday(user, existingReadings) {
  const userReadings = existingReadings.filter((r) => r.userId === user.id);
  if (!userReadings.length) {
    // у пользователя вообще нет показаний (например, аккаунт создан до
    // появления демо-данных) — сразу насыпаем полную историю
    return seedInitialHistory(user);
  }

  const newest = userReadings.reduce(
    (max, r) => (new Date(r.timestamp) > new Date(max.timestamp) ? r : max),
    userReadings[0]
  );
  const hoursSinceNewest = (Date.now() - new Date(newest.timestamp).getTime()) / (1000 * 60 * 60);
  if (hoursSinceNewest < REFRESH_AFTER_HOURS) return [];

  const base = dailyBase(user);
  return buildDayReadings(user.id, base, new Date(), HISTORY_DAYS, HISTORY_DAYS);
}

module.exports = { seedInitialHistory, maybeAppendToday };
