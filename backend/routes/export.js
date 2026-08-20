const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { requireAuth } = require('../middleware/auth');

router.get('/csv', requireAuth, exportController.exportToCSV);
router.get('/summary', requireAuth, exportController.getConsumptionSummary);

module.exports = router;
