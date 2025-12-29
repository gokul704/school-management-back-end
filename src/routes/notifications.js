const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, notificationsController.getAll);
router.get('/unread-count', authenticateToken, notificationsController.getUnreadCount);
router.patch('/:id/read', authenticateToken, notificationsController.markAsRead);
router.patch('/read-all', authenticateToken, notificationsController.markAllAsRead);
router.post('/', authenticateToken, notificationsController.create);

module.exports = router;

