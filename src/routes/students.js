const express = require('express');
const router = express.Router();
const studentsController = require('../controllers/studentsController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, studentsController.getAll);
router.get('/:id', authenticateToken, studentsController.getById);
router.post('/', authenticateToken, studentsController.create);
router.put('/:id', authenticateToken, studentsController.update);
router.delete('/:id', authenticateToken, studentsController.delete);
router.get('/:id/academic-records', authenticateToken, studentsController.getAcademicRecords);

module.exports = router;
