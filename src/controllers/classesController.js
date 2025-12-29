const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT c.*, 
             COUNT(DISTINCT s.id) as student_count,
             CAST(NULLIF(REGEXP_REPLACE(c.name, '[^0-9]', '', 'g'), '') AS INTEGER) as name_numeric
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id
      WHERE c.name !~ '^Class\\s+\\d+' 
        AND c.name !~ '^Class\\s+\\d+-[A-Z]'
        AND c.name !~ '^Class\\s+\\d+\\s+[A-Z]'
    `;
    const params = [];
    let paramCount = 1;

    // If teacher, only show classes they teach
    if (req.user.role === 'teacher') {
      const teacherResult = await pool.query('SELECT id FROM teachers WHERE email = $1', [req.user.email]);
      if (teacherResult.rows.length > 0) {
        const teacherId = teacherResult.rows[0].id;
        query += ` AND EXISTS (
          SELECT 1 FROM timetable_slots ts
          JOIN timetables t ON ts.timetable_id = t.id
          WHERE t.class_id = c.id AND ts.teacher_id = $${paramCount}
        )`;
        params.push(teacherId);
        paramCount++;
      } else {
        // Teacher not found, return empty
        return sendPaginated(res, [], {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0
        });
      }
    }

    if (search) {
      query += ` AND (c.name ILIKE $${paramCount} OR c.grade_level ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` GROUP BY c.id ORDER BY name_numeric ASC NULLS LAST, c.name ASC, c.academic_year DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    // Count only valid classes (numeric names, no "Class" prefix)
    const countResult = await pool.query(`
      SELECT COUNT(DISTINCT c.id) 
      FROM classes c
      WHERE c.name !~ '^Class\\s+\\d+' 
        AND c.name !~ '^Class\\s+\\d+-[A-Z]'
        AND c.name !~ '^Class\\s+\\d+\\s+[A-Z]'
    `);
    const total = parseInt(countResult.rows[0].count);

    // Fetch courses and available sections for each class separately to avoid cartesian product
    const classes = await Promise.all(result.rows.map(async (row) => {
      const coursesResult = await pool.query(
        `SELECT co.id, co.name, co.course_code
         FROM class_courses cc
         JOIN courses co ON cc.course_id = co.id
         WHERE cc.class_id = $1`,
        [row.id]
      );

      // Get unique sections for this class from students
      const sectionsResult = await pool.query(
        `SELECT DISTINCT section 
         FROM students 
         WHERE class_id = $1 AND section IS NOT NULL AND section != '' AND status = 'active'
         ORDER BY section`,
        [row.id]
      );

      const availableSections = sectionsResult.rows.map(r => r.section);

      return {
        id: row.id,
        name: row.name,
        academicYear: row.academic_year,
        gradeLevel: row.grade_level,
        section: null, // Keep null for backward compatibility, but sections are now in availableSections
        availableSections: availableSections,
        capacity: row.capacity || null,
        classroomName: row.classroom_name || null,
        studentCount: parseInt(row.student_count) || 0,
        courses: coursesResult.rows.map(c => ({
          id: c.id,
          name: c.name,
          courseCode: c.course_code
        })),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }));

    sendPaginated(res, classes, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get all classes error:', error);
    sendError(res, 'Failed to fetch classes', 500);
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT c.*, 
              COUNT(s.id) as student_count,
              COALESCE(json_agg(json_build_object('id', co.id, 'name', co.name, 'courseCode', co.course_code)) FILTER (WHERE co.id IS NOT NULL), '[]') as courses
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id
       LEFT JOIN class_courses cc ON cc.class_id = c.id
       LEFT JOIN courses co ON cc.course_id = co.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Class not found', 404);
    }

    const row = result.rows[0];
    const classData = {
      id: row.id,
      name: row.name,
      academicYear: row.academic_year,
      gradeLevel: row.grade_level,
      studentCount: parseInt(row.student_count) || 0,
      courses: row.courses || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    sendSuccess(res, classData);
  } catch (error) {
    console.error('Get class by id error:', error);
    sendError(res, 'Failed to fetch class', 500);
  }
};

const create = async (req, res) => {
  try {
    const { name, academicYear, gradeLevel, courseIds } = req.body;

    if (!name || !academicYear) {
      return sendError(res, 'Name and academic year are required', 400);
    }

    await pool.query('BEGIN');

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO classes (id, name, academic_year, grade_level, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [id, name, academicYear, gradeLevel || null]
    );

    // Map courses to class if provided
    if (courseIds && Array.isArray(courseIds) && courseIds.length > 0) {
      for (const courseId of courseIds) {
        await pool.query(
          `INSERT INTO class_courses (id, class_id, course_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (class_id, course_id) DO NOTHING`,
          [uuidv4(), id, courseId]
        );
      }
    }

    await pool.query('COMMIT');

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      name: row.name,
      academicYear: row.academic_year,
      gradeLevel: row.grade_level,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }, 'Class created successfully', 201);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Create class error:', error);
    sendError(res, 'Failed to create class', 500);
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, academicYear, gradeLevel, courseIds } = req.body;

    await pool.query('BEGIN');

    const result = await pool.query(
      `UPDATE classes 
       SET name = COALESCE($1, name),
           academic_year = COALESCE($2, academic_year),
           grade_level = COALESCE($3, grade_level),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [name, academicYear, gradeLevel, id]
    );

    if (result.rows.length === 0) {
      await pool.query('ROLLBACK');
      return sendError(res, 'Class not found', 404);
    }

    // Update course mappings if provided
    if (courseIds !== undefined) {
      // Delete existing mappings
      await pool.query('DELETE FROM class_courses WHERE class_id = $1', [id]);
      
      // Insert new mappings
      if (Array.isArray(courseIds) && courseIds.length > 0) {
        for (const courseId of courseIds) {
          await pool.query(
            `INSERT INTO class_courses (id, class_id, course_id)
             VALUES ($1, $2, $3)`,
            [uuidv4(), id, courseId]
          );
        }
      }
    }

    await pool.query('COMMIT');

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      name: row.name,
      academicYear: row.academic_year,
      gradeLevel: row.grade_level,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }, 'Class updated successfully');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Update class error:', error);
    sendError(res, 'Failed to update class', 500);
  }
};

const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if class has students
    const studentsResult = await pool.query(
      'SELECT COUNT(*) FROM students WHERE class_id = $1',
      [id]
    );

    if (parseInt(studentsResult.rows[0].count) > 0) {
      return sendError(res, 'Cannot delete class with assigned students', 400);
    }

    const result = await pool.query('DELETE FROM classes WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return sendError(res, 'Class not found', 404);
    }

    sendSuccess(res, null, 'Class deleted successfully');
  } catch (error) {
    console.error('Delete class error:', error);
    sendError(res, 'Failed to delete class', 500);
  }
};

const getClassStudents = async (req, res) => {
  try {
    const { id } = req.params;

    const classResult = await pool.query('SELECT * FROM classes WHERE id = $1', [id]);
    if (classResult.rows.length === 0) {
      return sendError(res, 'Class not found', 404);
    }

    const studentsResult = await pool.query(
      `SELECT s.*, c.name as class_name
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.class_id = $1
       ORDER BY s.first_name, s.last_name`,
      [id]
    );

    const students = studentsResult.rows.map(row => ({
      id: row.id,
      studentId: row.student_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      address: row.address,
      enrollmentDate: row.enrollment_date,
      status: row.status,
      className: row.class_name
    }));

    sendSuccess(res, {
      class: {
        id: classResult.rows[0].id,
        name: classResult.rows[0].name,
        academicYear: classResult.rows[0].academic_year,
        gradeLevel: classResult.rows[0].grade_level
      },
      students
    });
  } catch (error) {
    console.error('Get class students error:', error);
    sendError(res, 'Failed to fetch class students', 500);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteClass,
  getClassStudents
};
