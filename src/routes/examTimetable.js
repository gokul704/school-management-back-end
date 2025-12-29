const express = require('express');
const router = express.Router();
const examTimetableController = require('../controllers/examTimetableController');
const { authenticateToken } = require('../middleware/auth');

// Exam Halls
router.get('/halls', authenticateToken, examTimetableController.getExamHalls);
router.post('/halls', authenticateToken, examTimetableController.createExamHall);
router.put('/halls/:id', authenticateToken, examTimetableController.updateExamHall);
router.delete('/halls/:id', authenticateToken, examTimetableController.deleteExamHall);

// Exam Timetables
router.get('/timetables', authenticateToken, examTimetableController.getExamTimetables);
router.post('/timetables', authenticateToken, examTimetableController.createExamTimetable);
router.post('/timetables/generate-sitting-plan', authenticateToken, examTimetableController.generateExamSittingPlan);
router.get('/timetables/:id/students', authenticateToken, examTimetableController.getExamTimetableStudents);
router.post('/timetables/:examTimetableId/assign-students', authenticateToken, examTimetableController.assignStudentsToExam);

module.exports = router;

