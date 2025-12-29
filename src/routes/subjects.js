const express = require('express');
const router = express.Router();
const subjectsController = require('../controllers/subjectsController');
const { authenticateToken } = require('../middleware/auth');

// Get all subjects
router.get('/', authenticateToken, subjectsController.getAllSubjects);

// Get subject by ID
router.get('/:id', authenticateToken, subjectsController.getSubjectById);

// Create new subject
router.post('/', authenticateToken, subjectsController.createSubject);

// Update subject
router.put('/:id', authenticateToken, subjectsController.updateSubject);

// Delete subject
router.delete('/:id', authenticateToken, subjectsController.deleteSubject);

module.exports = router;

