const express = require('express');
const router = express.Router();
const gradesController = require('../controllers/gradesController');
const { authenticateToken } = require('../middleware/auth');

// Student grades
router.get('/students/:studentId', authenticateToken, gradesController.getStudentGrades);
router.get('/students/:studentId/progress-card', authenticateToken, gradesController.getProgressCard);

// Class grades
router.get('/classes/:classId', authenticateToken, gradesController.getClassGrades);

// Create/update/delete grades
router.post('/grades', authenticateToken, gradesController.createOrUpdateGrade);
router.put('/grades/:id', authenticateToken, gradesController.createOrUpdateGrade);
router.delete('/grades/:id', authenticateToken, gradesController.deleteGrade);

module.exports = router;

