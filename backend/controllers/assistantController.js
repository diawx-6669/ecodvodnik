const { readDb, writeDb } = require('../data/db');
const analyticsService = require('../services/analyticsService');
const petStateService = require('../services/petStateService');
const aiService = require('../services/aiService');

// POST /api/assistant/message
// Пользователь пишет питомцу, питомец отвечает на основе актуальных данных.
async function sendMessage(req, res) {
  const { message } = req.body;

  const db = readDb();
  const summary = analyticsService.buildSummary(db.readings);
  const petState = petStateService.computePetState(summary);

  const reply = await aiService.llmReply(summary, petState, message);

  db.messages.push({
    id: `${Date.now()}`,
    from: 'user',
    text: message || '',
    timestamp: new Date().toISOString(),
  });
  db.messages.push({
    id: `${Date.now()}_pet`,
    from: 'pet',
    text: reply,
    timestamp: new Date().toISOString(),
  });
  writeDb(db);

  return res.json({ reply, pet: petState, summary });
}

// GET /api/assistant/recommendations
function getRecommendations(req, res) {
  const db = readDb();
  const summary = analyticsService.buildSummary(db.readings);
  const recommendations = aiService.ruleBasedRecommendations(summary);

  return res.json({ recommendations });
}

// GET /api/assistant/history
function getHistory(req, res) {
  const db = readDb();
  return res.json(db.messages || []);
}

module.exports = { sendMessage, getRecommendations, getHistory };
