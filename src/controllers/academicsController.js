const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

// Gradebook
const getGradebook = async (req, res) => {
  try {
    const { studentId, courseId } = req.query;

    let query = `
      SELECT 
        c.id as course_id, c.name as course_name,
        s.id as student_id, s.first_name || ' ' || s.last_name as student_name,
        ar.grade, ar.academic_year, ar.credits
      FROM academic_records ar
      JOIN courses c ON ar.course_id = c.id
      JOIN students s ON ar.student_id = s.id
      WHERE s.id = $1
    `;
    const params = [studentId];

    if (courseId) {
      query += ' AND c.id = $2';
      params.push(courseId);
    }

    const result = await pool.query(query, params);

    const gradebook = result.rows.map(row => ({
      courseId: row.course_id,
      courseName: row.course_name,
      studentId: row.student_id,
      studentName: row.student_name,
      grade: row.grade,
      academicYear: row.academic_year,
      credits: row.credits
    }));

    sendSuccess(res, gradebook);
  } catch (error) {
    console.error('Get gradebook error:', error);
    sendError(res, 'Failed to fetch gradebook', 500);
  }
};

// Assignments
const getAssignments = async (req, res) => {
  try {
    const { page = 1, limit = 10, courseId } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT a.*, c.name as course_name,
      COALESCE(json_agg(json_build_object(
        'id', s.id, 'studentId', st.id, 'studentName', st.first_name || ' ' || st.last_name,
        'submittedAt', s.submitted_at, 'fileUrl', s.file_url,
        'status', s.status, 'score', s.score, 'feedback', s.feedback
      )) FILTER (WHERE s.id IS NOT NULL), '[]') as submissions
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      LEFT JOIN assignment_submissions s ON a.id = s.assignment_id
      LEFT JOIN students st ON s.student_id = st.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (courseId) {
      query += ` AND a.course_id = $${paramCount++}`;
      params.push(courseId);
    }

    query += ` GROUP BY a.id, c.name ORDER BY a.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const assignments = result.rows.map(row => ({
      id: row.id,
      courseId: row.course_id,
      courseName: row.course_name,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      maxScore: row.max_score,
      createdBy: row.created_by,
      createdAt: row.created_at,
      submissions: row.submissions || []
    }));

    sendPaginated(res, assignments, {
      page: parseInt(page),
      limit: parseInt(limit),
      total: assignments.length,
      totalPages: Math.ceil(assignments.length / limit)
    });
  } catch (error) {
    console.error('Get assignments error:', error);
    sendError(res, 'Failed to fetch assignments', 500);
  }
};

const createAssignment = async (req, res) => {
  try {
    const { courseId, title, description, dueDate, maxScore } = req.body;

    const result = await pool.query(
      `INSERT INTO assignments (id, course_id, title, description, due_date, max_score, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [uuidv4(), courseId, title, description, dueDate, maxScore, req.user.id]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      courseId: row.course_id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      maxScore: row.max_score,
      createdBy: row.created_by,
      createdAt: row.created_at,
      submissions: []
    }, 'Assignment created successfully', 201);
  } catch (error) {
    console.error('Create assignment error:', error);
    sendError(res, 'Failed to create assignment', 500);
  }
};

const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.keys(req.body).forEach(key => {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (req.body[key] !== undefined) {
        updates.push(`${dbKey} = $${paramCount++}`);
        values.push(req.body[key]);
      }
    });

    if (updates.length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    values.push(id);
    const query = `UPDATE assignments SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return sendError(res, 'Assignment not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      maxScore: row.max_score
    }, 'Assignment updated successfully');
  } catch (error) {
    console.error('Update assignment error:', error);
    sendError(res, 'Failed to update assignment', 500);
  }
};

const submitAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    const studentId = req.user.id; // Assuming student is logged in

    const result = await pool.query(
      `INSERT INTO assignment_submissions (id, assignment_id, student_id, file_url, status)
       VALUES ($1, $2, $3, $4, 'submitted')
       RETURNING *`,
      [uuidv4(), id, studentId, file ? `/uploads/${file.filename}` : null]
    );

    sendSuccess(res, {
      id: result.rows[0].id,
      assignmentId: result.rows[0].assignment_id,
      studentId: result.rows[0].student_id,
      fileUrl: result.rows[0].file_url,
      status: result.rows[0].status
    }, 'Assignment submitted successfully', 201);
  } catch (error) {
    console.error('Submit assignment error:', error);
    sendError(res, 'Failed to submit assignment', 500);
  }
};

const gradeAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { score, feedback } = req.body;

    const result = await pool.query(
      `UPDATE assignment_submissions 
       SET score = $1, feedback = $2, status = 'graded'
       WHERE id = $3
       RETURNING *`,
      [score, feedback, id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Submission not found', 404);
    }

    sendSuccess(res, {
      id: result.rows[0].id,
      score: result.rows[0].score,
      feedback: result.rows[0].feedback,
      status: result.rows[0].status
    }, 'Assignment graded successfully');
  } catch (error) {
    console.error('Grade assignment error:', error);
    sendError(res, 'Failed to grade assignment', 500);
  }
};

// Exams
const getExams = async (req, res) => {
  try {
    const { page = 1, limit = 10, courseId } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT e.*, c.name as course_name,
      COALESCE(json_agg(json_build_object(
        'id', r.id, 'studentId', s.id, 'studentName', s.first_name || ' ' || s.last_name,
        'score', r.score, 'grade', r.grade, 'publishedAt', r.published_at
      )) FILTER (WHERE r.id IS NOT NULL), '[]') as results
      FROM exams e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN exam_results r ON e.id = r.exam_id
      LEFT JOIN students s ON r.student_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (courseId) {
      query += ` AND e.course_id = $${paramCount++}`;
      params.push(courseId);
    }

    query += ` GROUP BY e.id, c.name ORDER BY e.exam_date DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const exams = result.rows.map(row => ({
      id: row.id,
      courseId: row.course_id,
      courseName: row.course_name,
      title: row.title,
      description: row.description,
      examDate: row.exam_date,
      duration: row.duration,
      maxScore: row.max_score,
      room: row.room,
      createdBy: row.created_by,
      createdAt: row.created_at,
      results: row.results || []
    }));

    sendPaginated(res, exams, {
      page: parseInt(page),
      limit: parseInt(limit),
      total: exams.length,
      totalPages: Math.ceil(exams.length / limit)
    });
  } catch (error) {
    console.error('Get exams error:', error);
    sendError(res, 'Failed to fetch exams', 500);
  }
};

const createExam = async (req, res) => {
  try {
    const { courseId, title, description, examDate, duration, maxScore, room } = req.body;

    const result = await pool.query(
      `INSERT INTO exams (id, course_id, title, description, exam_date, duration, max_score, room, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [uuidv4(), courseId, title, description, examDate, duration, maxScore, room, req.user.id]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      courseId: row.course_id,
      title: row.title,
      description: row.description,
      examDate: row.exam_date,
      duration: row.duration,
      maxScore: row.max_score,
      room: row.room,
      createdBy: row.created_by,
      createdAt: row.created_at,
      results: []
    }, 'Exam scheduled successfully', 201);
  } catch (error) {
    console.error('Create exam error:', error);
    sendError(res, 'Failed to schedule exam', 500);
  }
};

const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.keys(req.body).forEach(key => {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (req.body[key] !== undefined) {
        updates.push(`${dbKey} = $${paramCount++}`);
        values.push(req.body[key]);
      }
    });

    if (updates.length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    values.push(id);
    const query = `UPDATE exams SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return sendError(res, 'Exam not found', 404);
    }

    sendSuccess(res, result.rows[0], 'Exam updated successfully');
  } catch (error) {
    console.error('Update exam error:', error);
    sendError(res, 'Failed to update exam', 500);
  }
};

const publishExamResults = async (req, res) => {
  try {
    const { id } = req.params;
    const { results } = req.body;

    await pool.query('BEGIN');

    for (const result of results) {
      const grade = result.score >= 90 ? 'A' : result.score >= 80 ? 'B' : result.score >= 70 ? 'C' : result.score >= 60 ? 'D' : 'F';
      
      await pool.query(
        `INSERT INTO exam_results (id, exam_id, student_id, score, grade)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (exam_id, student_id)
         DO UPDATE SET score = $4, grade = $5, published_at = NOW()`,
        [uuidv4(), id, result.studentId, result.score, grade]
      );
    }

    await pool.query('COMMIT');

    sendSuccess(res, null, 'Exam results published successfully');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Publish exam results error:', error);
    sendError(res, 'Failed to publish results', 500);
  }
};

// Timetable
const getTimetable = async (req, res) => {
  try {
    const { classId, academicYear } = req.query;

    let query = `
      SELECT t.*, c.name as class_name,
      COALESCE(json_agg(json_build_object(
        'id', ts.id, 'dayOfWeek', ts.day_of_week, 'startTime', ts.start_time,
        'endTime', ts.end_time, 'courseId', co.id, 'courseName', co.name,
        'teacherId', te.id, 'teacherName', te.first_name || ' ' || te.last_name,
        'room', ts.room, 'durationMinutes', ts.duration_minutes, 'section', ts.section
      )) FILTER (WHERE ts.id IS NOT NULL), '[]') as schedule
      FROM timetables t
      JOIN classes c ON t.class_id = c.id
      LEFT JOIN timetable_slots ts ON t.id = ts.timetable_id
      LEFT JOIN courses co ON ts.course_id = co.id
      LEFT JOIN teachers te ON ts.teacher_id = te.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (classId) {
      query += ` AND t.class_id = $${paramCount++}`;
      params.push(classId);
    }
    // Make academic year matching more flexible - match by year or full string
    if (academicYear) {
      // Extract year from academic year string (e.g., "2024-2025" -> "2024" or "2025")
      const yearMatch = academicYear.match(/\d{4}/);
      if (yearMatch) {
        const year = yearMatch[0];
        query += ` AND (t.academic_year = $${paramCount} OR t.academic_year LIKE $${paramCount + 1} OR t.academic_year LIKE $${paramCount + 2})`;
        params.push(academicYear, `${year}%`, `%${year}%`);
        paramCount += 3;
      } else {
        query += ` AND t.academic_year = $${paramCount++}`;
        params.push(academicYear);
      }
    }

    query += ' GROUP BY t.id, c.name ORDER BY t.created_at DESC LIMIT 1';

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return sendError(res, 'Timetable not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      classId: row.class_id,
      className: row.class_name,
      academicYear: row.academic_year,
      schedule: row.schedule || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Get timetable error:', error);
    sendError(res, 'Failed to fetch timetable', 500);
  }
};

const createTimetable = async (req, res) => {
  try {
    const { classId, academicYear, schedule } = req.body;

    await pool.query('BEGIN');

    const timetableResult = await pool.query(
      `INSERT INTO timetables (id, class_id, academic_year)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [uuidv4(), classId, academicYear]
    );

    const timetableId = timetableResult.rows[0].id;

    for (const slot of schedule) {
      await pool.query(
        `INSERT INTO timetable_slots (id, timetable_id, day_of_week, start_time, end_time, course_id, teacher_id, room, duration_minutes, section)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uuidv4(), timetableId, slot.dayOfWeek, slot.startTime,
          slot.endTime, slot.courseId, slot.teacherId, slot.room,
          slot.durationMinutes || 45, slot.section || null
        ]
      );
    }

    await pool.query('COMMIT');

    sendSuccess(res, timetableResult.rows[0], 'Timetable created successfully', 201);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Create timetable error:', error);
    sendError(res, 'Failed to create timetable', 500);
  }
};

const updateTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    const { schedule } = req.body;

    await pool.query('BEGIN');

    // Delete existing slots
    await pool.query('DELETE FROM timetable_slots WHERE timetable_id = $1', [id]);

    // Insert new slots
    for (const slot of schedule) {
      await pool.query(
        `INSERT INTO timetable_slots (id, timetable_id, day_of_week, start_time, end_time, course_id, teacher_id, room, duration_minutes, section)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uuidv4(), id, slot.dayOfWeek, slot.startTime,
          slot.endTime, slot.courseId, slot.teacherId, slot.room,
          slot.durationMinutes || 45, slot.section || null
        ]
      );
    }

    await pool.query('COMMIT');

    sendSuccess(res, null, 'Timetable updated successfully');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Update timetable error:', error);
    sendError(res, 'Failed to update timetable', 500);
  }
};

const generateTimetable = async (req, res) => {
  try {
    const { classId, academicYear, sections, slotDuration, workingHours } = req.body;

    // Default values
    const duration = slotDuration || 45; // minutes
    const hours = workingHours || { start: '08:00', end: '17:00' };
    const classSections = sections || []; // e.g., ['A', 'B', 'C']

    // Get class details
    const classResult = await pool.query('SELECT * FROM classes WHERE id = $1', [classId]);
    if (classResult.rows.length === 0) {
      return sendError(res, 'Class not found', 404);
    }

    // Get courses mapped to this class (only mapped courses)
    // Don't filter by academic_year too strictly - use mapped courses regardless of year
    const coursesResult = await pool.query(
      `SELECT DISTINCT c.*, t.id as teacher_id, t.first_name || ' ' || t.last_name as teacher_name, t.specialization
       FROM courses c
       INNER JOIN class_courses cc ON cc.course_id = c.id AND cc.class_id = $1
       LEFT JOIN teachers t ON c.teacher_id = t.id
       WHERE c.status = 'active'
       ORDER BY c.name`,
      [classId]
    );

    const courses = coursesResult.rows;
    if (courses.length === 0) {
      // Check if class has any courses mapped at all
      const mappingCheck = await pool.query(
        'SELECT COUNT(*) as count FROM class_courses WHERE class_id = $1',
        [classId]
      );
      const mappedCount = parseInt(mappingCheck.rows[0].count);
      
      if (mappedCount === 0) {
        return sendError(res, 'No courses mapped to this class. Please map courses to the class first.', 400);
      } else {
        return sendError(res, `No active courses found for academic year ${academicYear}. The mapped courses may be inactive or for a different academic year.`, 400);
      }
    }

    // Get existing timetables to check for conflicts
    const existingTimetablesResult = await pool.query(
      `SELECT ts.day_of_week, ts.start_time, ts.end_time, ts.teacher_id, ts.room, ts.section
       FROM timetables t
       JOIN timetable_slots ts ON t.id = ts.timetable_id
       WHERE t.academic_year = $1`,
      [academicYear]
    );

    const existingSlots = existingTimetablesResult.rows;

    // Helper function to check if time slot conflicts
    const hasConflict = (day, startTime, endTime, teacherId, room, section) => {
      return existingSlots.some(slot => {
        const slotStart = slot.start_time;
        const slotEnd = slot.end_time;
        const timeOverlaps = (startTime < slotEnd && endTime > slotStart);
        
        return slot.day_of_week === day && timeOverlaps && (
          (teacherId && slot.teacher_id === teacherId) ||
          (room && slot.room === room) ||
          (section && slot.section === section)
        );
      });
    };

    // Helper function to add minutes to time string
    const addMinutes = (timeStr, minutes) => {
      const [hours, mins] = timeStr.split(':').map(Number);
      const totalMinutes = hours * 60 + mins + minutes;
      const newHours = Math.floor(totalMinutes / 60);
      const newMins = totalMinutes % 60;
      return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
    };

    // Generate time slots
    const generateTimeSlots = () => {
      const slots = [];
      const [startHour, startMin] = hours.start.split(':').map(Number);
      const [endHour, endMin] = hours.end.split(':').map(Number);
      const startTotal = startHour * 60 + startMin;
      const endTotal = endHour * 60 + endMin;

      let currentTime = startTotal;
      while (currentTime + duration <= endTotal) {
        const hours = Math.floor(currentTime / 60);
        const mins = currentTime % 60;
        slots.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
        currentTime += duration;
      }
      return slots;
    };

    const timeSlots = generateTimeSlots();
    const daysOfWeek = [1, 2, 3, 4, 5]; // Monday to Friday
    const schedule = [];

    // Filter courses that have teachers
    const validCourses = courses.filter(c => c.teacher_id);
    
    if (validCourses.length === 0) {
      return sendError(res, 'No courses with assigned teachers found', 400);
    }

    // If sections are provided, create timetable for each section
    const sectionsToProcess = classSections.length > 0 ? classSections : [null];

    for (const section of sectionsToProcess) {
      // Track which courses have been scheduled for this section
      const scheduledCourses = new Set();
      
      // Try to schedule each course at least once per week
      // Distribute courses evenly across days
      const coursesPerDay = Math.ceil(validCourses.length / daysOfWeek.length);
      
      // Schedule multiple sessions per course per week (e.g., 2-3 times per week for each course)
      const sessionsPerCourse = Math.max(2, Math.floor((daysOfWeek.length * timeSlots.length) / validCourses.length));
      
      // Create all possible slot combinations
      const allSlots = [];
      for (const day of daysOfWeek) {
        for (const timeSlot of timeSlots) {
          allSlots.push({ day, timeSlot });
        }
      }
      
      // Shuffle slots for better distribution
      for (let i = allSlots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allSlots[i], allSlots[j]] = [allSlots[j], allSlots[i]];
      }
      
      // Track how many times each course has been scheduled
      const courseScheduleCount = {};
      validCourses.forEach(c => courseScheduleCount[c.id] = 0);
      
      // Try to schedule each course multiple times
      for (let session = 0; session < sessionsPerCourse; session++) {
        for (const course of validCourses) {
          let placed = false;
          
          // Try each available slot
          for (const slot of allSlots) {
            if (placed) break;
            
            const startTime = slot.timeSlot;
            const endTime = addMinutes(startTime, duration);
            
            // Check if this slot is already used for this section
            const slotUsed = schedule.some(s => 
              s.dayOfWeek === slot.day && 
              s.startTime === startTime && 
              (s.section === section || (s.section === null && section === null))
            );
            
            if (slotUsed) continue;
            
            // Try different rooms
            for (let roomNum = 1; roomNum <= 20 && !placed; roomNum++) {
              const room = `Room ${roomNum}`;
              if (!hasConflict(slot.day, startTime, endTime, course.teacher_id, room, section)) {
                schedule.push({
                  dayOfWeek: slot.day,
                  startTime,
                  endTime,
                  courseId: course.id,
                  teacherId: course.teacher_id,
                  room,
                  durationMinutes: duration,
                  section: section || null,
                });
                courseScheduleCount[course.id]++;
                scheduledCourses.add(course.id);
                placed = true;
              }
            }
          }
        }
      }
      
      // Ensure each course is scheduled at least once
      for (const course of validCourses) {
        if (courseScheduleCount[course.id] === 0) {
          // Course wasn't scheduled, try to find any available slot
          for (const slot of allSlots) {
            const startTime = slot.timeSlot;
            const endTime = addMinutes(startTime, duration);
            
            const slotUsed = schedule.some(s => 
              s.dayOfWeek === slot.day && 
              s.startTime === startTime && 
              (s.section === section || (s.section === null && section === null))
            );
            
            if (slotUsed) continue;
            
            for (let roomNum = 1; roomNum <= 20; roomNum++) {
              const room = `Room ${roomNum}`;
              if (!hasConflict(slot.day, startTime, endTime, course.teacher_id, room, section)) {
                schedule.push({
                  dayOfWeek: slot.day,
                  startTime,
                  endTime,
                  courseId: course.id,
                  teacherId: course.teacher_id,
                  room,
                  durationMinutes: duration,
                  section: section || null,
                });
                courseScheduleCount[course.id]++;
                break;
              }
            }
            
            if (courseScheduleCount[course.id] > 0) break;
          }
        }
      }
      
      // If some courses weren't scheduled, try to fit them in remaining slots
      const stillUnscheduled = validCourses.filter(c => !scheduledCourses.has(c.id));
      if (stillUnscheduled.length > 0) {
        for (const day of daysOfWeek) {
          if (stillUnscheduled.length === 0) break;
          
          for (let timeSlotIndex = 0; timeSlotIndex < timeSlots.length && stillUnscheduled.length > 0; timeSlotIndex++) {
            const startTime = timeSlots[timeSlotIndex];
            const endTime = addMinutes(startTime, duration);
            
            // Check if this slot is already used
            const slotUsed = schedule.some(s => 
              s.dayOfWeek === day && 
              s.startTime === startTime && 
              (s.section === section || (s.section === null && section === null))
            );
            
            if (slotUsed) continue;
            
            // Try to place an unscheduled course
            for (let i = 0; i < stillUnscheduled.length; i++) {
              const course = stillUnscheduled[i];
              for (let roomNum = 1; roomNum <= 20; roomNum++) {
                const room = `Room ${roomNum}`;
                if (!hasConflict(day, startTime, endTime, course.teacher_id, room, section)) {
                  schedule.push({
                    dayOfWeek: day,
                    startTime,
                    endTime,
                    courseId: course.id,
                    teacherId: course.teacher_id,
                    room,
                    durationMinutes: duration,
                    section: section || null,
                  });
                  scheduledCourses.add(course.id);
                  stillUnscheduled.splice(i, 1);
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (schedule.length === 0) {
      return sendError(res, 'Could not generate timetable. Possible conflicts or insufficient time slots.', 400);
    }

    sendSuccess(res, {
      schedule,
      summary: {
        totalSlots: schedule.length,
        courses: courses.length,
        sections: classSections.length || 1,
        duration,
      },
    }, 'Timetable generated successfully');
  } catch (error) {
    console.error('Generate timetable error:', error);
    sendError(res, 'Failed to generate timetable', 500);
  }
};

module.exports = {
  getGradebook,
  getAssignments,
  createAssignment,
  updateAssignment,
  submitAssignment,
  gradeAssignment,
  getExams,
  createExam,
  updateExam,
  publishExamResults,
  getTimetable,
  createTimetable,
  updateTimetable,
  generateTimetable,
};

