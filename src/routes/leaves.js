const express = require('express');
const router = express.Router();
const leavesController = require('../controllers/leavesController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, leavesController.getLeaves);
router.post('/', authenticateToken, leavesController.createLeave);
router.get('/:id', authenticateToken, leavesController.getLeaveById);
router.patch('/:id/status', authenticateToken, leavesController.updateLeaveStatus);

module.exports = router;

