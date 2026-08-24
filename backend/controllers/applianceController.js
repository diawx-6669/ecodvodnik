const { readDb } = require('../data/db');
const analyticsService = require('../services/analyticsService');
const applianceLookupService = require('../services/applianceLookupService');

// POST /api/appliances/lookup
async function lookupAppliance(req, res) {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const model = typeof req.body.model === 'string' ? req.body.model.trim() : '';
  const userWatts = req.body.userWatts != null ? Number(req.body.userWatts) : null;
  const userHoursPerDay = req.body.userHoursPerDay != null ? Number(req.body.userHoursPerDay) : null;
  const ratedWatts = req.body.ratedWatts != null ? Number(req.body.ratedWatts) : null;

  const db = readDb();
  const readings = req.user
    ? db.readings.filter((r) => !r.userId || r.userId === req.user.id)
    : db.readings.filter((r) => !r.userId);

  const summary = analyticsService.buildSummary(readings, req.user, db.settings);
  const weeklyKwh = summary.electricity.total_kwh;
  const dailyKwh = weeklyKwh > 0 ? Math.round((weeklyKwh / 7) * 10) / 10 : null;

  const userReadings =
    dailyKwh != null
      ? { dailyKwh, weeklyKwh, costKzt: summary.electricity.cost_kzt }
      : null;

  const result = await applianceLookupService.lookupAppliance({
    name,
    model,
    userWatts,
    userHoursPerDay,
    ratedWatts,
    userReadings,
  });

  if (!result.found) {
    return res.status(400).json(result);
  }

  return res.json(result);
}

module.exports = { lookupAppliance };
