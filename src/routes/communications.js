const express = require('express');
const router = express.Router();
const communicationsController = require('../controllers/communicationsController');
const { authenticateToken } = require('../middleware/auth');

// Messages
router.get('/messages', authenticateToken, communicationsController.getMessages);
router.post('/messages', authenticateToken, communicationsController.sendMessage);
router.patch('/messages/:id/read', authenticateToken, communicationsController.markMessageAsRead);
router.get('/students-for-messaging', authenticateToken, communicationsController.getStudentsForMessaging);

// Announcements
router.get('/announcements', authenticateToken, communicationsController.getAnnouncements);
router.post('/announcements', authenticateToken, communicationsController.createAnnouncement);

// Events
router.get('/events', authenticateToken, communicationsController.getEvents);
router.post('/events', authenticateToken, communicationsController.createEvent);
router.put('/events/:id', authenticateToken, communicationsController.updateEvent);
router.delete('/events/:id', authenticateToken, communicationsController.deleteEvent);

module.exports = router;

