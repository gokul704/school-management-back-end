const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', classId, section } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT DISTINCT s.*, c.name as class_name, c.grade_level
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // If teacher, only show students from classes they teach
    if (req.user.role === 'teacher') {
      const teacherResult = await pool.query('SELECT id FROM teachers WHERE email = $1', [req.user.email]);
      if (teacherResult.rows.length > 0) {
        const teacherId = teacherResult.rows[0].id;
        query += ` AND EXISTS (
          SELECT 1 FROM timetable_slots ts
          JOIN timetables t ON ts.timetable_id = t.id
          WHERE t.class_id = s.class_id AND ts.teacher_id = $${paramCount}
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
      query += ` AND (
        s.first_name ILIKE $${paramCount} OR
        s.last_name ILIKE $${paramCount} OR
        s.student_id ILIKE $${paramCount} OR
        s.email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (classId) {
      query += ` AND s.class_id = $${paramCount++}`;
      params.push(classId);
    }

    if (section) {
      query += ` AND s.section = $${paramCount++}`;
      params.push(section);
    }

    query += ` ORDER BY s.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM students');
    const total = parseInt(countResult.rows[0].count);

    const students = result.rows.map(row => ({
      id: row.id,
      studentId: row.student_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      address: row.address,
      parentName: row.parent_name,
      parentPhone: row.parent_phone,
      parentEmail: row.parent_email,
      enrollmentDate: row.enrollment_date,
      classId: row.class_id,
      className: row.class_name,
      section: row.section,
      gradeLevel: row.grade_level,
      status: row.status,
      healthData: row.health_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    sendPaginated(res, students, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get all students error:', error);
    sendError(res, 'Failed to fetch students', 500);
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT s.*, c.name as class_name
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Student not found', 404);
    }

    const row = result.rows[0];
    const student = {
      id: row.id,
      studentId: row.student_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      address: row.address,
      parentName: row.parent_name,
      parentPhone: row.parent_phone,
      parentEmail: row.parent_email,
      enrollmentDate: row.enrollment_date,
      classId: row.class_id,
      className: row.class_name,
      section: row.section,
      status: row.status,
      healthData: row.health_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    sendSuccess(res, student);
  } catch (error) {
    console.error('Get student by id error:', error);
    sendError(res, 'Failed to fetch student', 500);
  }
};

const create = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, dateOfBirth, gender,
      address, parentName, parentPhone, parentEmail,
      enrollmentDate, classId, section, status = 'active', healthData
    } = req.body;

    // Generate student ID
    const studentIdResult = await pool.query(
      'SELECT COUNT(*) FROM students WHERE academic_year = $1',
      [new Date().getFullYear().toString()]
    );
    const studentId = `STU${new Date().getFullYear()}${String(parseInt(studentIdResult.rows[0].count) + 1).padStart(4, '0')}`;

    const result = await pool.query(
      `INSERT INTO students (
        id, student_id, first_name, last_name, email, phone, date_of_birth,
        gender, address, parent_name, parent_phone, parent_email,
        enrollment_date, class_id, section, status, health_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        uuidv4(), studentId, firstName, lastName, email, phone, dateOfBirth,
        gender, address, parentName, parentPhone, parentEmail,
        enrollmentDate, classId, section || null, status, healthData ? JSON.stringify(healthData) : null
      ]
    );

    const row = result.rows[0];
    const student = {
      id: row.id,
      studentId: row.student_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      address: row.address,
      parentName: row.parent_name,
      parentPhone: row.parent_phone,
      parentEmail: row.parent_email,
      enrollmentDate: row.enrollment_date,
      classId: row.class_id,
      section: row.section,
      status: row.status,
      healthData: row.health_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    sendSuccess(res, student, 'Student created successfully', 201);
  } catch (error) {
    console.error('Create student error:', error);
    if (error.code === '23505') { // Unique violation
      sendError(res, 'Student with this email or student ID already exists', 400);
    } else {
      sendError(res, 'Failed to create student', 500);
    }
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName, lastName, email, phone, dateOfBirth, gender,
      address, parentName, parentPhone, parentEmail,
      enrollmentDate, classId, section, status, healthData
    } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(lastName);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (phone !== undefined) updates.push(`phone = $${paramCount++}`), values.push(phone);
    if (dateOfBirth !== undefined) updates.push(`date_of_birth = $${paramCount++}`), values.push(dateOfBirth);
    if (gender !== undefined) updates.push(`gender = $${paramCount++}`), values.push(gender);
    if (address !== undefined) updates.push(`address = $${paramCount++}`), values.push(address);
    if (parentName !== undefined) updates.push(`parent_name = $${paramCount++}`), values.push(parentName);
    if (parentPhone !== undefined) updates.push(`parent_phone = $${paramCount++}`), values.push(parentPhone);
    if (parentEmail !== undefined) updates.push(`parent_email = $${paramCount++}`), values.push(parentEmail);
    if (enrollmentDate !== undefined) updates.push(`enrollment_date = $${paramCount++}`), values.push(enrollmentDate);
    if (classId !== undefined) updates.push(`class_id = $${paramCount++}`), values.push(classId);
    if (section !== undefined) updates.push(`section = $${paramCount++}`), values.push(section);
    if (status !== undefined) updates.push(`status = $${paramCount++}`), values.push(status);
    if (healthData !== undefined) updates.push(`health_data = $${paramCount++}`), values.push(healthData ? JSON.stringify(healthData) : null);

    if (updates.length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    values.push(id);
    const query = `UPDATE students SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return sendError(res, 'Student not found', 404);
    }

    const row = result.rows[0];
    const student = {
      id: row.id,
      studentId: row.student_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      address: row.address,
      parentName: row.parent_name,
      parentPhone: row.parent_phone,
      parentEmail: row.parent_email,
      enrollmentDate: row.enrollment_date,
      classId: row.class_id,
      section: row.section,
      status: row.status,
      healthData: row.health_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    sendSuccess(res, student, 'Student updated successfully');
  } catch (error) {
    console.error('Update student error:', error);
    sendError(res, 'Failed to update student', 500);
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return sendError(res, 'Student not found', 404);
    }

    sendSuccess(res, null, 'Student deleted successfully');
  } catch (error) {
    console.error('Delete student error:', error);
    sendError(res, 'Failed to delete student', 500);
  }
};

const getAcademicRecords = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT ar.*, c.name as course_name, c.course_code
       FROM academic_records ar
       JOIN courses c ON ar.course_id = c.id
       WHERE ar.student_id = $1
       ORDER BY ar.academic_year DESC`,
      [id]
    );

    const records = result.rows.map(row => ({
      id: row.id,
      studentId: row.student_id,
      courseId: row.course_id,
      courseName: row.course_name,
      courseCode: row.course_code,
      grade: row.grade,
      academicYear: row.academic_year,
      credits: row.credits,
      createdAt: row.created_at
    }));

    sendSuccess(res, records);
  } catch (error) {
    console.error('Get academic records error:', error);
    sendError(res, 'Failed to fetch academic records', 500);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: deleteStudent,
  getAcademicRecords
};
