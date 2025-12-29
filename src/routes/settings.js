const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticateToken, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Get all settings
router.get('/', authenticateToken, settingsController.getSettings);

// Get specific setting
router.get('/:key', authenticateToken, settingsController.getSetting);

// Update setting
router.put('/:key', authenticateToken, settingsController.updateSetting);

// Upload logo (admin only)
router.post('/logo', authenticateToken, authorize('admin'), upload.single('logo'), settingsController.uploadLogo);

module.exports = router;

