const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

const markAttendance = async (req, res) => {
  try {
    const { studentId, courseId, date, status, notes } = req.body;
    const markedBy = req.user.id;

    const result = await pool.query(
      `INSERT INTO attendance (id, student_id, course_id, date, status, marked_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (student_id, course_id, date)
       DO UPDATE SET status = $5, notes = $7, marked_by = $6
       RETURNING *`,
      [uuidv4(), studentId, courseId, date, status, markedBy, notes]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      studentId: row.student_id,
      courseId: row.course_id,
      date: row.date,
      status: row.status,
      markedBy: row.marked_by,
      notes: row.notes,
      createdAt: row.created_at
    }, 'Attendance marked successfully', 201);
  } catch (error) {
    console.error('Mark attendance error:', error);
    sendError(res, 'Failed to mark attendance', 500);
  }
};

const getByDate = async (req, res) => {
  try {
    const { date, courseId } = req.query;

    let query = `
      SELECT a.*, s.first_name || ' ' || s.last_name as student_name,
             c.name as course_name, u.name as marked_by_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN courses c ON a.course_id = c.id
      JOIN users u ON a.marked_by = u.id
      WHERE a.date = $1
    `;
    const params = [date];

    if (courseId) {
      query += ' AND a.course_id = $2';
      params.push(courseId);
    }

    query += ' ORDER BY a.created_at DESC';

    const result = await pool.query(query, params);

    const attendances = result.rows.map(row => ({
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      courseId: row.course_id,
      courseName: row.course_name,
      date: row.date,
      status: row.status,
      markedBy: row.marked_by_name,
      notes: row.notes,
      createdAt: row.created_at
    }));

    sendSuccess(res, attendances);
  } catch (error) {
    console.error('Get attendance by date error:', error);
    sendError(res, 'Failed to fetch attendance', 500);
  }
};

const getByStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    let query = `
      SELECT a.*, c.name as course_name
      FROM attendance a
      JOIN courses c ON a.course_id = c.id
      WHERE a.student_id = $1
    `;
    const params = [id];

    if (startDate && endDate) {
      query += ' AND a.date BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY a.date DESC';

    const result = await pool.query(query, params);

    const attendances = result.rows.map(row => ({
      id: row.id,
      studentId: row.student_id,
      courseId: row.course_id,
      courseName: row.course_name,
      date: row.date,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at
    }));

    sendSuccess(res, attendances);
  } catch (error) {
    console.error('Get attendance by student error:', error);
    sendError(res, 'Failed to fetch attendance', 500);
  }
};

const getReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const result = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'present') as present_days,
        COUNT(*) FILTER (WHERE status = 'absent') as absent_days,
        COUNT(*) as total_days
      FROM attendance
      WHERE student_id = $1 AND date BETWEEN $2 AND $3`,
      [id, startDate, endDate]
    );

    const stats = result.rows[0];
    const totalDays = parseInt(stats.total_days);
    const presentDays = parseInt(stats.present_days);
    const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    sendSuccess(res, {
      studentId: id,
      totalDays,
      presentDays,
      absentDays: parseInt(stats.absent_days),
      attendancePercentage: Math.round(attendancePercentage * 100) / 100,
      period: { start: startDate, end: endDate }
    });
  } catch (error) {
    console.error('Get attendance report error:', error);
    sendError(res, 'Failed to generate report', 500);
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const result = await pool.query(
      'UPDATE attendance SET status = $1, notes = $2 WHERE id = $3 RETURNING *',
      [status, notes, id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Attendance record not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      studentId: row.student_id,
      courseId: row.course_id,
      date: row.date,
      status: row.status,
      notes: row.notes
    }, 'Attendance updated successfully');
  } catch (error) {
    console.error('Update attendance error:', error);
    sendError(res, 'Failed to update attendance', 500);
  }
};

// Get students by class and section for attendance
const getStudentsForAttendance = async (req, res) => {
  try {
    const { classId, section } = req.query;

    if (!classId) {
      return sendError(res, 'classId is required', 400);
    }

    let query = `
      SELECT DISTINCT s.id, s.student_id, s.first_name, s.last_name, s.email,
             c.name as class_name, s.section
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.class_id = $1 AND s.status = 'active'
    `;
    const params = [classId];

    if (section) {
      query += ` AND s.section = $2`;
      params.push(section);
    }

    query += ` ORDER BY s.first_name, s.last_name`;

    const result = await pool.query(query, params);

    const students = result.rows.map(row => ({
      id: row.id,
      studentId: row.student_id,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: `${row.first_name} ${row.last_name}`,
      email: row.email,
      className: row.class_name,
      classSection: row.class_section
    }));

    sendSuccess(res, students);
  } catch (error) {
    console.error('Get students for attendance error:', error);
    sendError(res, 'Failed to fetch students', 500);
  }
};

// Get courses for a class
const getCoursesForClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { academicYear } = req.query;

    let query = `
      SELECT DISTINCT c.*, t.first_name || ' ' || t.last_name as teacher_name
      FROM courses c
      JOIN class_courses cc ON cc.course_id = c.id
      LEFT JOIN teachers t ON c.teacher_id = t.id
      WHERE cc.class_id = $1 AND c.status = 'active'
    `;
    const params = [classId];

    if (academicYear) {
      query += ` AND c.academic_year = $2`;
      params.push(academicYear);
    }

    query += ` ORDER BY c.name`;

    const result = await pool.query(query, params);

    const courses = result.rows.map(row => ({
      id: row.id,
      courseCode: row.course_code,
      name: row.name,
      description: row.description,
      teacherId: row.teacher_id,
      teacherName: row.teacher_name,
      department: row.department,
      academicYear: row.academic_year
    }));

    sendSuccess(res, courses);
  } catch (error) {
    console.error('Get courses for class error:', error);
    sendError(res, 'Failed to fetch courses', 500);
  }
};

// Get attendance by class and date (for table view)
const getByClassAndDate = async (req, res) => {
  try {
    const { classId, date, section } = req.query;

    if (!classId || !date) {
      return sendError(res, 'classId and date are required', 400);
    }

    // Get all students in the class
    let studentsQuery = `
      SELECT s.id, s.student_id, s.first_name, s.last_name, s.section
      FROM students s
      WHERE s.class_id = $1 AND s.status = 'active'
    `;
    const studentsParams = [classId];

    if (section) {
      studentsQuery += ` AND s.section = $2`;
      studentsParams.push(section);
    }

    studentsQuery += ` ORDER BY s.first_name, s.last_name`;

    const studentsResult = await pool.query(studentsQuery, studentsParams);
    const students = studentsResult.rows;

    // Get all courses for this class
    const coursesResult = await pool.query(
      `SELECT DISTINCT c.id, c.name, c.course_code
       FROM courses c
       JOIN class_courses cc ON cc.course_id = c.id
       WHERE cc.class_id = $1 AND c.status = 'active'
       ORDER BY c.name`,
      [classId]
    );
    const courses = coursesResult.rows;

    // Get attendance records for this date
    const attendanceResult = await pool.query(
      `SELECT a.*, s.id as student_id
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE a.date = $1 AND s.class_id = $2 AND s.status = 'active'
       ${section ? 'AND s.section = $3' : ''}
       ORDER BY s.first_name, s.last_name`,
      section ? [date, classId, section] : [date, classId]
    );

    // Organize attendance by student and course
    const attendanceMap = {};
    attendanceResult.rows.forEach(row => {
      const key = `${row.student_id}_${row.course_id}`;
      attendanceMap[key] = {
        id: row.id,
        status: row.status,
        notes: row.notes
      };
    });

    // Build response with students and their attendance for each course
    const response = students.map(student => {
      const studentAttendance = courses.map(course => {
        const key = `${student.id}_${course.id}`;
        const attendance = attendanceMap[key];
        return {
          courseId: course.id,
          courseName: course.name,
          courseCode: course.course_code,
          attendanceId: attendance?.id || null,
          status: attendance?.status || null,
          notes: attendance?.notes || null
        };
      });

      return {
        studentId: student.id,
        studentNumber: student.student_id,
        firstName: student.first_name,
        lastName: student.last_name,
        fullName: `${student.first_name} ${student.last_name}`,
        courses: studentAttendance
      };
    });

    sendSuccess(res, {
      date,
      classId,
      section: section || null,
      students: response,
      courses: courses.map(c => ({ id: c.id, name: c.name, courseCode: c.course_code }))
    });
  } catch (error) {
    console.error('Get attendance by class and date error:', error);
    sendError(res, 'Failed to fetch attendance', 500);
  }
};

// Get student attendance calendar (all dates with attendance)
const getStudentCalendar = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return sendError(res, 'startDate and endDate are required', 400);
    }

    // Get all attendance records for the student in the date range
    const attendanceResult = await pool.query(
      `SELECT a.*, c.id as course_id, c.name as course_name, c.course_code
       FROM attendance a
       JOIN courses c ON a.course_id = c.id
       WHERE a.student_id = $1 AND a.date BETWEEN $2 AND $3
       ORDER BY a.date DESC, c.name`,
      [id, startDate, endDate]
    );

    // Organize by date
    const calendarData = {};
    attendanceResult.rows.forEach(row => {
      const date = row.date;
      if (!calendarData[date]) {
        calendarData[date] = [];
      }
      calendarData[date].push({
        id: row.id,
        courseId: row.course_id,
        courseName: row.course_name,
        courseCode: row.course_code,
        status: row.status,
        notes: row.notes,
        createdAt: row.created_at
      });
    });

    sendSuccess(res, {
      studentId: id,
      startDate,
      endDate,
      calendar: calendarData
    });
  } catch (error) {
    console.error('Get student calendar error:', error);
    sendError(res, 'Failed to fetch calendar', 500);
  }
};

// Mark attendance for multiple courses at once
const markBulkAttendance = async (req, res) => {
  try {
    const { studentId, date, attendances } = req.body; // attendances: [{ courseId, status, notes }]
    const markedBy = req.user.id;

    if (!studentId || !date || !Array.isArray(attendances) || attendances.length === 0) {
      return sendError(res, 'studentId, date, and attendances array are required', 400);
    }

    await pool.query('BEGIN');

    const results = [];
    for (const att of attendances) {
      const result = await pool.query(
        `INSERT INTO attendance (id, student_id, course_id, date, status, marked_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (student_id, course_id, date)
         DO UPDATE SET status = $5, notes = $7, marked_by = $6
         RETURNING *`,
        [uuidv4(), studentId, att.courseId, date, att.status, markedBy, att.notes || null]
      );
      results.push(result.rows[0]);
    }

    await pool.query('COMMIT');

    sendSuccess(res, {
      studentId,
      date,
      count: results.length,
      attendances: results.map(row => ({
        id: row.id,
        courseId: row.course_id,
        date: row.date,
        status: row.status,
        notes: row.notes
      }))
    }, 'Attendance marked successfully', 201);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Mark bulk attendance error:', error);
    sendError(res, 'Failed to mark attendance', 500);
  }
};

module.exports = {
  markAttendance,
  markBulkAttendance,
  getByDate,
  getByClassAndDate,
  getByStudent,
  getStudentCalendar,
  getStudentsForAttendance,
  getCoursesForClass,
  getReport,
  update
};
