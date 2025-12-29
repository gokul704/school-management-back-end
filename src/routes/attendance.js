const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, attendanceController.markAttendance);
router.post('/bulk', authenticateToken, attendanceController.markBulkAttendance);
router.get('/', authenticateToken, attendanceController.getByDate);
router.get('/class', authenticateToken, attendanceController.getByClassAndDate);
router.get('/students', authenticateToken, attendanceController.getStudentsForAttendance);
router.get('/courses/class/:classId', authenticateToken, attendanceController.getCoursesForClass);
router.get('/student/:id', authenticateToken, attendanceController.getByStudent);
router.get('/student/:id/calendar', authenticateToken, attendanceController.getStudentCalendar);
router.get('/report/:id', authenticateToken, attendanceController.getReport);
router.put('/:id', authenticateToken, attendanceController.update);

module.exports = router;
