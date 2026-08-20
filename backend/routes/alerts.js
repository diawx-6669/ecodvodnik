const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alertsController');
const { requireAuth } = require('../middleware/auth');

router.post('/check', requireAuth, alertsController.checkAndCreateAlerts);
router.get('/', requireAuth, alertsController.getUserAlerts);
router.put('/:alertId/acknowledge', requireAuth, alertsController.acknowledgeAlert);

module.exports = router;
