const express = require('express');
const router = express.Router();
const applianceController = require('../controllers/applianceController');
const { optionalAuth } = require('../middleware/auth');

router.post('/lookup', optionalAuth, applianceController.lookupAppliance);

module.exports = router;
