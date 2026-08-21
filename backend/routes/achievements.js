const express = require('express');
const router = express.Router();
const achievementsController = require('../controllers/achievementsController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, achievementsController.list);
router.post('/check', requireAuth, achievementsController.check);

module.exports = router;
