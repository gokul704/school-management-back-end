const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT c.*, t.first_name || ' ' || t.last_name as teacher_name
      FROM courses c
      LEFT JOIN teachers t ON c.teacher_id = t.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // If teacher, only show courses they teach
    if (req.user.role === 'teacher') {
      const teacherResult = await pool.query('SELECT id FROM teachers WHERE email = $1', [req.user.email]);
      if (teacherResult.rows.length > 0) {
        query += ` AND c.teacher_id = $${paramCount++}`;
        params.push(teacherResult.rows[0].id);
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
        c.name ILIKE $${paramCount} OR
        c.course_code ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM courses');
    const total = parseInt(countResult.rows[0].count);

    const courses = result.rows.map(row => ({
      id: row.id,
      courseCode: row.course_code,
      name: row.name,
      description: row.description,
      credits: row.credits,
      teacherId: row.teacher_id,
      teacherName: row.teacher_name,
      department: row.department,
      academicYear: row.academic_year,
      maxStudents: row.max_students,
      enrolledStudents: row.enrolled_students,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    sendPaginated(res, courses, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get all courses error:', error);
    sendError(res, 'Failed to fetch courses', 500);
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.*, t.first_name || ' ' || t.last_name as teacher_name
       FROM courses c
       LEFT JOIN teachers t ON c.teacher_id = t.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Course not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      courseCode: row.course_code,
      name: row.name,
      description: row.description,
      credits: row.credits,
      teacherId: row.teacher_id,
      teacherName: row.teacher_name,
      department: row.department,
      academicYear: row.academic_year,
      maxStudents: row.max_students,
      enrolledStudents: row.enrolled_students,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Get course error:', error);
    sendError(res, 'Failed to fetch course', 500);
  }
};

const create = async (req, res) => {
  try {
    const {
      courseCode, name, description, credits, teacherId,
      department, academicYear, maxStudents, status = 'active'
    } = req.body;

    const result = await pool.query(
      `INSERT INTO courses (
        id, course_code, name, description, credits, teacher_id,
        department, academic_year, max_students, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        uuidv4(), courseCode, name, description, credits, teacherId,
        department, academicYear, maxStudents, status
      ]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      courseCode: row.course_code,
      name: row.name,
      description: row.description,
      credits: row.credits,
      teacherId: row.teacher_id,
      department: row.department,
      academicYear: row.academic_year,
      maxStudents: row.max_students,
      enrolledStudents: row.enrolled_students,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }, 'Course created successfully', 201);
  } catch (error) {
    console.error('Create course error:', error);
    sendError(res, 'Failed to create course', 500);
  }
};

const update = async (req, res) => {
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
    const query = `UPDATE courses SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return sendError(res, 'Course not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      courseCode: row.course_code,
      name: row.name,
      description: row.description,
      credits: row.credits,
      teacherId: row.teacher_id,
      department: row.department,
      academicYear: row.academic_year,
      maxStudents: row.max_students,
      enrolledStudents: row.enrolled_students,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }, 'Course updated successfully');
  } catch (error) {
    console.error('Update course error:', error);
    sendError(res, 'Failed to update course', 500);
  }
};

const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM courses WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return sendError(res, 'Course not found', 404);
    }

    sendSuccess(res, null, 'Course deleted successfully');
  } catch (error) {
    console.error('Delete course error:', error);
    sendError(res, 'Failed to delete course', 500);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: deleteCourse
};

