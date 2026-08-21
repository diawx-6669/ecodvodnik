const express = require('express');
const router = express.Router();
const tipsController = require('../controllers/tipsController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, tipsController.getTips);

module.exports = router;
