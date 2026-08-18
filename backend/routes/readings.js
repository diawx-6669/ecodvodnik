const express = require('express');
const router = express.Router();
const readingsController = require('../controllers/readingsController');

router.post('/', readingsController.addReading);
router.get('/', readingsController.listReadings);
router.post('/import-csv', readingsController.importReadings);

module.exports = router;
