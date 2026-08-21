const express = require('express');
const router = express.Router();
const integrationsController = require('../controllers/integrationsController');
const { requireAuth } = require('../middleware/auth');

router.post('/api-key', requireAuth, integrationsController.issueApiKey);
router.delete('/api-key', requireAuth, integrationsController.revokeApiKey);
router.get('/', requireAuth, integrationsController.getStatus);
// Публичный webhook — авторизация через X-Api-Key, не через JWT.
router.post('/webhook', integrationsController.webhook);

module.exports = router;
