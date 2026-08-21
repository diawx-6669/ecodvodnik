const express = require('express');
const router = express.Router();
const householdController = require('../controllers/householdController');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, householdController.create);
router.post('/join', requireAuth, householdController.join);
router.get('/', requireAuth, householdController.get);
router.post('/leave', requireAuth, householdController.leave);

module.exports = router;
