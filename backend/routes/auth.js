const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', requireAuth, authController.me);
router.patch('/me', requireAuth, authController.updateMe);
router.post('/change-password', requireAuth, authController.changePassword);
router.post('/admin-code', requireAuth, authController.claimAdmin);

module.exports = router;
