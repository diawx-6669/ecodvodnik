const express = require('express');
const router = express.Router();
const goalsController = require('../controllers/goalsController');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, goalsController.setGoal);
router.get('/', requireAuth, goalsController.getGoals);
router.get('/progress', requireAuth, goalsController.getGoalProgress);

module.exports = router;
