const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM teachers WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (search) {
      query += ` AND (
        first_name ILIKE $${paramCount} OR
        last_name ILIKE $${paramCount} OR
        teacher_id ILIKE $${paramCount} OR
        email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM teachers');
    const total = parseInt(countResult.rows[0].count);

    const teachers = result.rows.map(row => ({
      id: row.id,
      teacherId: row.teacher_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      address: row.address,
      qualification: row.qualification,
      specialization: row.specialization,
      hireDate: row.hire_date,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    sendPaginated(res, teachers, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get all teachers error:', error);
    sendError(res, 'Failed to fetch teachers', 500);
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM teachers WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return sendError(res, 'Teacher not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      teacherId: row.teacher_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      address: row.address,
      qualification: row.qualification,
      specialization: row.specialization,
      hireDate: row.hire_date,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Get teacher error:', error);
    sendError(res, 'Failed to fetch teacher', 500);
  }
};

const create = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, dateOfBirth, gender,
      address, qualification, specialization, hireDate, status = 'active'
    } = req.body;

    const teacherId = `TCH${new Date().getFullYear()}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

    const result = await pool.query(
      `INSERT INTO teachers (
        id, teacher_id, first_name, last_name, email, phone, date_of_birth,
        gender, address, qualification, specialization, hire_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        uuidv4(), teacherId, firstName, lastName, email, phone, dateOfBirth,
        gender, address, qualification, specialization, hireDate, status
      ]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      teacherId: row.teacher_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      address: row.address,
      qualification: row.qualification,
      specialization: row.specialization,
      hireDate: row.hire_date,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }, 'Teacher created successfully', 201);
  } catch (error) {
    console.error('Create teacher error:', error);
    sendError(res, 'Failed to create teacher', 500);
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
    const query = `UPDATE teachers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return sendError(res, 'Teacher not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      teacherId: row.teacher_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
      gender: row.gender,
      address: row.address,
      qualification: row.qualification,
      specialization: row.specialization,
      hireDate: row.hire_date,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }, 'Teacher updated successfully');
  } catch (error) {
    console.error('Update teacher error:', error);
    sendError(res, 'Failed to update teacher', 500);
  }
};

const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM teachers WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return sendError(res, 'Teacher not found', 404);
    }

    sendSuccess(res, null, 'Teacher deleted successfully');
  } catch (error) {
    console.error('Delete teacher error:', error);
    sendError(res, 'Failed to delete teacher', 500);
  }
};

const getSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Query timetable_slots instead of teacher_schedules to get actual timetable data
    const result = await pool.query(
      `SELECT 
         ts.id,
         ts.timetable_id,
         ts.day_of_week,
         ts.start_time,
         ts.end_time,
         ts.course_id,
         ts.teacher_id,
         ts.room,
         ts.duration_minutes,
         ts.section,
         co.name as course_name,
         co.course_code,
         c.name as class_name,
         t.academic_year
       FROM timetable_slots ts
       JOIN timetables t ON ts.timetable_id = t.id
       JOIN classes c ON t.class_id = c.id
       LEFT JOIN courses co ON ts.course_id = co.id
       WHERE ts.teacher_id = $1
       ORDER BY ts.day_of_week, ts.start_time`,
      [id]
    );

    const schedule = result.rows.map(row => ({
      id: row.id,
      teacherId: row.teacher_id,
      courseId: row.course_id,
      courseName: row.course_name || 'Unknown Course',
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      room: row.room,
      className: row.class_name,
      academicYear: row.academic_year,
      section: row.section,
    }));

    sendSuccess(res, schedule);
  } catch (error) {
    console.error('Get schedule error:', error);
    sendError(res, 'Failed to fetch schedule', 500);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: deleteTeacher,
  getSchedule
};
