const express = require('express');
const router = express.Router();
const holidaysController = require('../controllers/holidaysController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Get all holidays (with optional filters)
router.get('/', authenticateToken, holidaysController.getAll);

// Get holiday by ID
router.get('/:id', authenticateToken, holidaysController.getById);

// Create holiday (admin only)
router.post('/', authenticateToken, authorize('admin'), holidaysController.create);

// Update holiday (admin only)
router.put('/:id', authenticateToken, authorize('admin'), holidaysController.update);

// Delete holiday (admin only)
router.delete('/:id', authenticateToken, authorize('admin'), holidaysController.delete);

module.exports = router;

