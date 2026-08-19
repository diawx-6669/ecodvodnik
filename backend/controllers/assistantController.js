const { readDb, writeDb } = require('../data/db');
const analyticsService = require('../services/analyticsService');
const petStateService = require('../services/petStateService');
const aiService = require('../services/aiService');

// POST /api/assistant/message
// Пользователь пишет питомцу, питомец отвечает на основе актуальных данных.
async function sendMessage(req, res) {
  const message = typeof req.body.message === 'string' ? req.body.message : '';

  const db = readDb();
  const readings = req.user
    ? db.readings.filter((r) => !r.userId || r.userId === req.user.id)
    : db.readings.filter((r) => !r.userId);
  const summary = analyticsService.buildSummary(readings, req.user);
  const petState = petStateService.computePetState(summary);

  const reply = await aiService.llmReply(summary, petState, message, req.user);

  const userMsg = {
    id: `${Date.now()}`,
    from: 'user',
    text: message || '',
    timestamp: new Date().toISOString(),
  };
  const petMsg = {
    id: `${Date.now()}_pet`,
    from: 'pet',
    text: reply,
    timestamp: new Date().toISOString(),
  };
  if (req.user) {
    userMsg.userId = req.user.id;
    petMsg.userId = req.user.id;
  }
  db.messages.push(userMsg, petMsg);
  writeDb(db);

  return res.json({ reply, pet: petState, summary });
}

// GET /api/assistant/recommendations
function getRecommendations(req, res) {
  const db = readDb();
  const readings = req.user
    ? db.readings.filter((r) => !r.userId || r.userId === req.user.id)
    : db.readings.filter((r) => !r.userId);
  const summary = analyticsService.buildSummary(readings, req.user);
  const recommendations = aiService.ruleBasedRecommendations(summary);

  return res.json({ recommendations });
}

// GET /api/assistant/history
function getHistory(req, res) {
  const db = readDb();
  const messages = db.messages || [];
  // Аккаунту показываем его переписку с питомцем (+ общую демо-историю без
  // владельца); гостю — только общую демо-историю, без чужих сообщений.
  const scoped = req.user
    ? messages.filter((m) => !m.userId || m.userId === req.user.id)
    : messages.filter((m) => !m.userId);
  return res.json(scoped);
}

module.exports = { sendMessage, getRecommendations, getHistory };
