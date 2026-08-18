const { readDb } = require('../data/db');
const analyticsService = require('../services/analyticsService');
const petStateService = require('../services/petStateService');

// GET /api/analytics/summary
function getSummary(req, res) {
  const db = readDb();
  const summary = analyticsService.buildSummary(db.readings);
  const petState = petStateService.computePetState(summary);

  return res.json({ summary, pet: petState });
}

module.exports = { getSummary };
