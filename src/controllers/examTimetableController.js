const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

// Exam Halls - Now returns class-section combinations
const getExamHalls = async (req, res) => {
  try {
    // Get all classes with their sections
    const classesResult = await pool.query(
      `SELECT DISTINCT c.id, c.name, c.academic_year, c.grade_level,
              s.section,
              COUNT(DISTINCT s.id) as student_count
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
       WHERE s.section IS NOT NULL AND s.section != ''
       GROUP BY c.id, c.name, c.academic_year, c.grade_level, s.section
       ORDER BY c.name, s.section`
    );

    // Also get classes without sections (for backward compatibility)
    const classesWithoutSections = await pool.query(
      `SELECT DISTINCT c.id, c.name, c.academic_year, c.grade_level,
              COUNT(DISTINCT s.id) as student_count
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
       WHERE NOT EXISTS (
         SELECT 1 FROM students s2 
         WHERE s2.class_id = c.id AND s2.section IS NOT NULL AND s2.section != ''
       )
       GROUP BY c.id, c.name, c.academic_year, c.grade_level
       ORDER BY c.name`
    );

    const halls = [];

    // Add class-section combinations
    classesResult.rows.forEach(row => {
      halls.push({
        id: `${row.id}_${row.section}`, // Composite ID
        classId: row.id,
        section: row.section,
        name: `Class ${row.name}-${row.section}`,
        capacity: parseInt(row.student_count) || 0,
        building: null,
        floor: null,
        description: `Class ${row.name}, Section ${row.section}`,
        isActive: true,
        createdAt: null,
        updatedAt: null
      });
    });

    // Add classes without sections
    classesWithoutSections.rows.forEach(row => {
      halls.push({
        id: `${row.id}_none`,
        classId: row.id,
        section: null,
        name: `Class ${row.name}`,
        capacity: parseInt(row.student_count) || 0,
        building: null,
        floor: null,
        description: `Class ${row.name}`,
        isActive: true,
        createdAt: null,
        updatedAt: null
      });
    });

    sendSuccess(res, halls);
  } catch (error) {
    console.error('Get exam halls error:', error);
    sendError(res, 'Failed to fetch exam halls', 500);
  }
};

const createExamHall = async (req, res) => {
  try {
    const { name, capacity, building, floor, description } = req.body;

    const result = await pool.query(
      `INSERT INTO exam_halls (id, name, capacity, building, floor, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [uuidv4(), name, capacity, building, floor, description]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      name: row.name,
      capacity: row.capacity,
      building: row.building,
      floor: row.floor,
      description: row.description,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }, 'Exam hall created successfully', 201);
  } catch (error) {
    console.error('Create exam hall error:', error);
    sendError(res, 'Failed to create exam hall', 500);
  }
};

const updateExamHall = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, capacity, building, floor, description, isActive } = req.body;

    const result = await pool.query(
      `UPDATE exam_halls
       SET name = $1, capacity = $2, building = $3, floor = $4, description = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [name, capacity, building, floor, description, isActive !== undefined ? isActive : true, id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Exam hall not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      name: row.name,
      capacity: row.capacity,
      building: row.building,
      floor: row.floor,
      description: row.description,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }, 'Exam hall updated successfully');
  } catch (error) {
    console.error('Update exam hall error:', error);
    sendError(res, 'Failed to update exam hall', 500);
  }
};

const deleteExamHall = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM exam_halls WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return sendError(res, 'Exam hall not found', 404);
    }

    sendSuccess(res, null, 'Exam hall deleted successfully');
  } catch (error) {
    console.error('Delete exam hall error:', error);
    sendError(res, 'Failed to delete exam hall', 500);
  }
};

// Exam Timetable
const getExamTimetables = async (req, res) => {
  try {
    const { examId, date } = req.query;

    let query = `
      SELECT et.*, e.title as exam_title, e.course_id, c.name as course_name,
             eh.name as hall_name, eh.capacity, eh.building,
             t.first_name || ' ' || t.last_name as invigilator_name,
             COUNT(esa.id) as assigned_students
      FROM exam_timetables et
      JOIN exams e ON et.exam_id = e.id
      JOIN courses c ON e.course_id = c.id
      JOIN exam_halls eh ON et.exam_hall_id = eh.id
      LEFT JOIN teachers t ON et.invigilator_id = t.id
      LEFT JOIN exam_student_assignments esa ON et.id = esa.exam_timetable_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (examId) {
      query += ` AND et.exam_id = $${paramCount++}`;
      params.push(examId);
    }
    if (date) {
      query += ` AND et.date = $${paramCount++}`;
      params.push(date);
    }

    query += ' GROUP BY et.id, e.title, e.course_id, c.name, eh.name, eh.capacity, eh.building, t.first_name, t.last_name ORDER BY et.date, et.start_time';

    const result = await pool.query(query, params);

    const timetables = result.rows.map(row => ({
      id: row.id,
      examId: row.exam_id,
      examTitle: row.exam_title,
      courseId: row.course_id,
      courseName: row.course_name,
      examHallId: row.exam_hall_id,
      hallName: row.hall_name,
      hallCapacity: row.capacity,
      building: row.building,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      invigilatorId: row.invigilator_id,
      invigilatorName: row.invigilator_name,
      assignedStudents: parseInt(row.assigned_students) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    sendSuccess(res, timetables);
  } catch (error) {
    console.error('Get exam timetables error:', error);
    sendError(res, 'Failed to fetch exam timetables', 500);
  }
};

const createExamTimetable = async (req, res) => {
  try {
    const { examId, examHallId, date, startTime, endTime, invigilatorId, studentAssignments } = req.body;

    await pool.query('BEGIN');

    // Create exam timetable
    const timetableResult = await pool.query(
      `INSERT INTO exam_timetables (id, exam_id, exam_hall_id, date, start_time, end_time, invigilator_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [uuidv4(), examId, examHallId, date, startTime, endTime, invigilatorId]
    );

    const timetableId = timetableResult.rows[0].id;

    // Assign students
    if (studentAssignments && studentAssignments.length > 0) {
      for (const assignment of studentAssignments) {
        await pool.query(
          `INSERT INTO exam_student_assignments (id, exam_timetable_id, student_id, seat_number)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (exam_timetable_id, student_id) DO UPDATE
           SET seat_number = EXCLUDED.seat_number`,
          [uuidv4(), timetableId, assignment.studentId, assignment.seatNumber || null]
        );
      }
    }

    await pool.query('COMMIT');

    sendSuccess(res, { id: timetableId }, 'Exam timetable created successfully', 201);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Create exam timetable error:', error);
    sendError(res, 'Failed to create exam timetable', 500);
  }
};

const getExamTimetableStudents = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT esa.*, s.first_name, s.last_name, s.student_id, s.email
       FROM exam_student_assignments esa
       JOIN students s ON esa.student_id = s.id
       WHERE esa.exam_timetable_id = $1
       ORDER BY esa.seat_number, s.first_name`,
      [id]
    );

    const assignments = result.rows.map(row => ({
      id: row.id,
      examTimetableId: row.exam_timetable_id,
      studentId: row.student_id,
      studentName: `${row.first_name} ${row.last_name}`,
      studentCode: row.student_id,
      email: row.email,
      seatNumber: row.seat_number,
      createdAt: row.created_at
    }));

    sendSuccess(res, assignments);
  } catch (error) {
    console.error('Get exam timetable students error:', error);
    sendError(res, 'Failed to fetch student assignments', 500);
  }
};

const assignStudentsToExam = async (req, res) => {
  try {
    const { examTimetableId } = req.params;
    const { studentAssignments } = req.body;

    await pool.query('BEGIN');

    // Delete existing assignments
    await pool.query('DELETE FROM exam_student_assignments WHERE exam_timetable_id = $1', [examTimetableId]);

    // Insert new assignments
    for (const assignment of studentAssignments) {
      await pool.query(
        `INSERT INTO exam_student_assignments (id, exam_timetable_id, student_id, seat_number)
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), examTimetableId, assignment.studentId, assignment.seatNumber || null]
      );
    }

    await pool.query('COMMIT');

    sendSuccess(res, null, 'Students assigned successfully');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Assign students error:', error);
    sendError(res, 'Failed to assign students', 500);
  }
};

// Auto-generate exam sitting plan
const generateExamSittingPlan = async (req, res) => {
  try {
    const { classIds, classId, date, startTime, endTime, examTitle } = req.body;

    // Support both single classId (backward compatibility) and multiple classIds
    const classesToProcess = classIds && Array.isArray(classIds) && classIds.length > 0 
      ? classIds 
      : classId 
        ? [classId] 
        : [];

    if (classesToProcess.length === 0 || !date || !startTime || !endTime) {
      return sendError(res, 'classIds (or classId), date, startTime, and endTime are required', 400);
    }

    // Get all classes details
    const classResult = await pool.query(
      `SELECT id, name, academic_year FROM classes WHERE id = ANY($1::uuid[])`,
      [classesToProcess]
    );

    if (classResult.rows.length === 0) {
      return sendError(res, 'No classes found', 404);
    }

    const classDataList = classResult.rows;

    // Try to find an active course from any of the selected classes
    let course = null;
    let courseResult;
    
    for (const classData of classDataList) {
      courseResult = await pool.query(
        `SELECT c.id, c.name, c.course_code
         FROM courses c
         JOIN class_courses cc ON cc.course_id = c.id
         WHERE cc.class_id = $1 AND c.status = 'active'
         LIMIT 1`,
        [classData.id]
      );
      
      if (courseResult.rows.length > 0) {
        course = courseResult.rows[0];
        break;
      }
    }

    let exam;
    let examId;

    // Create a generic exam entry for this seating plan
    // If no course found, we'll create an exam without a specific course (using a placeholder)
    // Get unique class names (remove duplicates)
    const uniqueClassNames = [...new Set(classDataList.map(c => c.name))].sort((a, b) => {
      // Sort numerically if both are numbers, otherwise alphabetically
      const aNum = parseInt(a);
      const bNum = parseInt(b);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return a.localeCompare(b);
    });
    const classNames = uniqueClassNames.join(', ');
    const examTitleText = examTitle || `Seating Plan - ${classNames}`;
    const examDate = new Date(date);
    examDate.setHours(parseInt(startTime.split(':')[0]), parseInt(startTime.split(':')[1]));
    
    // If no course found, try to get any active course from the database as a fallback
    // Or create exam without course_id (if your schema allows it)
    if (!course) {
      // Try to get any active course as a fallback
      const fallbackCourseResult = await pool.query(
        `SELECT id, name, course_code FROM courses WHERE status = 'active' LIMIT 1`
      );
      
      if (fallbackCourseResult.rows.length > 0) {
        course = fallbackCourseResult.rows[0];
      } else {
        // If still no course, we can't create an exam entry
        // But we can still generate the seating plan without an exam entry
        // For now, return error but with a helpful message
        return sendError(res, 'No active courses found in the system. Please ensure at least one course is active and mapped to the selected classes.', 400);
      }
    }
    
    const examInsertResult = await pool.query(
      `INSERT INTO exams (id, course_id, title, description, exam_date, duration, max_score, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        uuidv4(),
        course.id,
        examTitleText,
        `Auto-generated seating plan for ${classNames}`,
        examDate.toISOString(),
        120, // Default 2 hours
        100, // Default max score
        req.user.id
      ]
    );
    
    exam = examInsertResult.rows[0];
    examId = exam.id;

    // Get all students from all selected classes with their sections
    const studentsResult = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, s.student_id, s.section, s.class_id,
              c.name as class_name
       FROM students s
       JOIN classes c ON s.class_id = c.id
       WHERE s.class_id = ANY($1::uuid[]) AND s.status = 'active'
       ORDER BY c.name, s.section, s.first_name, s.last_name`,
      [classesToProcess]
    );

    const allStudents = studentsResult.rows;
    const totalStudents = allStudents.length;

    if (totalStudents === 0) {
      return sendError(res, 'No students found in the selected classes', 400);
    }

    // Group students by class and section
    const studentsByClassSection = {};
    allStudents.forEach(student => {
      const section = student.section || 'none';
      const key = `${student.class_id}_${section}`;
      if (!studentsByClassSection[key]) {
        studentsByClassSection[key] = {
          classId: student.class_id,
          className: student.class_name,
          section: section,
          students: []
        };
      }
      studentsByClassSection[key].students.push(student);
    });

    await pool.query('BEGIN');

    const timetables = [];
    let totalAssigned = 0;

    // Assign students to their own class-section as exam hall
    for (const [key, classSectionData] of Object.entries(studentsByClassSection)) {
      const { className, section, students: studentsInSection } = classSectionData;
      const hallName = section !== 'none' 
        ? `Class ${className}-${section}` 
        : `Class ${className}`;
      
      // Create or get exam hall entry for this class-section
      let examHallId;
      const existingHall = await pool.query(
        `SELECT id FROM exam_halls WHERE name = $1`,
        [hallName]
      );

      if (existingHall.rows.length > 0) {
        examHallId = existingHall.rows[0].id;
      } else {
        // Create virtual exam hall for this class-section
        const hallInsertResult = await pool.query(
          `INSERT INTO exam_halls (id, name, capacity, building, floor, description, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [uuidv4(), hallName, studentsInSection.length, null, null, `Class ${className}${section !== 'none' ? `, Section ${section}` : ''}`, true]
        );
        examHallId = hallInsertResult.rows[0].id;
      }

      // Create exam timetable for this class-section
      const timetableResult = await pool.query(
        `INSERT INTO exam_timetables (id, exam_id, exam_hall_id, date, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [uuidv4(), examId, examHallId, date, startTime, endTime]
      );

      const timetableId = timetableResult.rows[0].id;

      // Assign students to this hall with seat numbers
      for (let i = 0; i < studentsInSection.length; i++) {
        const student = studentsInSection[i];
        const seatNumber = `${String(i + 1).padStart(2, '0')}`;
        
        await pool.query(
          `INSERT INTO exam_student_assignments (id, exam_timetable_id, student_id, seat_number)
           VALUES ($1, $2, $3, $4)`,
          [uuidv4(), timetableId, student.id, seatNumber]
        );
      }

      timetables.push({
        timetableId,
        hallId: examHallId,
        hallName: hallName,
        building: null,
        floor: null,
        capacity: studentsInSection.length,
        assignedStudents: studentsInSection.length,
        students: studentsInSection.map((s, idx) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          studentId: s.student_id,
          seatNumber: `${String(idx + 1).padStart(2, '0')}`,
        })),
      });

      totalAssigned += studentsInSection.length;
    }

    await pool.query('COMMIT');

    // Get course name for response
    const courseName = courseResult.rows[0].name;

    sendSuccess(res, {
      examId,
      examTitle: exam.title,
      courseName: courseName,
      totalStudents,
      totalAssigned,
      timetables,
    }, 'Exam sitting plan generated successfully', 201);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Generate sitting plan error:', error);
    sendError(res, 'Failed to generate sitting plan', 500);
  }
};

module.exports = {
  getExamHalls,
  createExamHall,
  updateExamHall,
  deleteExamHall,
  getExamTimetables,
  createExamTimetable,
  getExamTimetableStudents,
  assignStudentsToExam,
  generateExamSittingPlan,
};

