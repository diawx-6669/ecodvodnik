const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

router.get('/summary', analyticsController.getSummary);
router.get('/device-status', analyticsController.getDeviceStatus);

module.exports = router;
