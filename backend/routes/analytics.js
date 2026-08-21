const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { optionalAuth } = require('../middleware/auth');

router.get('/summary', optionalAuth, analyticsController.getSummary);
router.get('/history', optionalAuth, analyticsController.getHistory);
router.get('/device-status', analyticsController.getDeviceStatus);

module.exports = router;
