const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistantController');

router.post('/message', assistantController.sendMessage);
router.get('/recommendations', assistantController.getRecommendations);
router.get('/history', assistantController.getHistory);

module.exports = router;
