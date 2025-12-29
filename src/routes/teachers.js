const express = require('express');
const router = express.Router();
const teachersController = require('../controllers/teachersController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, teachersController.getAll);
router.get('/:id', authenticateToken, teachersController.getById);
router.post('/', authenticateToken, teachersController.create);
router.put('/:id', authenticateToken, teachersController.update);
router.delete('/:id', authenticateToken, teachersController.delete);
router.get('/:id/schedule', authenticateToken, teachersController.getSchedule);

module.exports = router;
