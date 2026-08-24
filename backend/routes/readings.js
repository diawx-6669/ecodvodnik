const express = require('express');
const router = express.Router();
const readingsController = require('../controllers/readingsController');
const { optionalAuth } = require('../middleware/auth');

router.post('/', optionalAuth, readingsController.addReading);
router.get('/', optionalAuth, readingsController.listReadings);
router.post('/import-csv', optionalAuth, readingsController.importReadings);
router.post('/photo-analyze', optionalAuth, readingsController.analyzePhoto);

module.exports = router;
