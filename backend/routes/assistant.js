const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistantController');
const { optionalAuth } = require('../middleware/auth');

router.post('/message', optionalAuth, assistantController.sendMessage);
router.get('/recommendations', optionalAuth, assistantController.getRecommendations);
router.get('/history', optionalAuth, assistantController.getHistory);

module.exports = router;
