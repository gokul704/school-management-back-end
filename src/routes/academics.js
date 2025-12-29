const express = require('express');
const router = express.Router();
const academicsController = require('../controllers/academicsController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Gradebook
router.get('/gradebook', authenticateToken, academicsController.getGradebook);

// Assignments
router.get('/assignments', authenticateToken, academicsController.getAssignments);
router.post('/assignments', authenticateToken, academicsController.createAssignment);
router.put('/assignments/:id', authenticateToken, academicsController.updateAssignment);
router.post('/assignments/:id/submit', authenticateToken, upload.single('file'), academicsController.submitAssignment);
router.post('/assignments/submissions/:id/grade', authenticateToken, academicsController.gradeAssignment);

// Exams
router.get('/exams', authenticateToken, academicsController.getExams);
router.post('/exams', authenticateToken, academicsController.createExam);
router.put('/exams/:id', authenticateToken, academicsController.updateExam);
router.post('/exams/:id/results', authenticateToken, academicsController.publishExamResults);

// Timetable
router.get('/timetable', authenticateToken, academicsController.getTimetable);
router.post('/timetable', authenticateToken, academicsController.createTimetable);
router.put('/timetable/:id', authenticateToken, academicsController.updateTimetable);
router.post('/timetable/generate', authenticateToken, academicsController.generateTimetable);

module.exports = router;

