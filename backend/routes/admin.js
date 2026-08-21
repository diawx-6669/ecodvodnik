const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

router.get('/users', requireAdmin, adminController.listUsers);
router.put('/users/:userId/role', requireAdmin, adminController.setUserRole);
router.get('/stats', requireAdmin, adminController.globalStats);
router.get('/settings', requireAdmin, adminController.getSettings);
router.put('/settings', requireAdmin, adminController.updateSettings);

module.exports = router;
