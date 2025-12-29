const express = require('express');
const router = express.Router();
const coursesController = require('../controllers/coursesController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, coursesController.getAll);
router.get('/:id', authenticateToken, coursesController.getById);
router.post('/', authenticateToken, coursesController.create);
router.put('/:id', authenticateToken, coursesController.update);
router.delete('/:id', authenticateToken, coursesController.delete);

module.exports = router;

