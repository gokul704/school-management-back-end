const express = require('express');
const router = express.Router();
const classesController = require('../controllers/classesController');
const { authenticateToken } = require('../middleware/auth');

// Get all classes
router.get('/', authenticateToken, classesController.getAll);

// Get class by ID
router.get('/:id', authenticateToken, classesController.getById);

// Create new class
router.post('/', authenticateToken, classesController.create);

// Update class
router.put('/:id', authenticateToken, classesController.update);

// Delete class
router.delete('/:id', authenticateToken, classesController.deleteClass);

// Get students in a class
router.get('/:id/students', authenticateToken, classesController.getClassStudents);

module.exports = router;

