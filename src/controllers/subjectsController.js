const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

const getAllSubjects = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM courses WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (search) {
      query += ` AND (
        name ILIKE $${paramCount} OR
        course_code ILIKE $${paramCount} OR
        department ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM courses');
    const total = parseInt(countResult.rows[0].count);

    const subjects = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      code: row.course_code,
      description: row.description,
      department: row.department,
      credits: row.credits,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    sendPaginated(res, subjects, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get all subjects error:', error);
    sendError(res, 'Failed to fetch subjects', 500);
  }
};

const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM courses WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return sendError(res, 'Subject not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      name: row.name,
      code: row.course_code,
      description: row.description,
      department: row.department,
      credits: row.credits,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Get subject by id error:', error);
    sendError(res, 'Failed to fetch subject', 500);
  }
};

const createSubject = async (req, res) => {
  try {
    const { name, code, description, department, credits } = req.body;

    if (!name || !code) {
      return sendError(res, 'Name and code are required', 400);
    }

    const result = await pool.query(
      `INSERT INTO courses (id, name, course_code, description, department, credits, academic_year, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       RETURNING *`,
      [
        uuidv4(), name, code, description || null, department || null,
        credits || 3, new Date().getFullYear().toString()
      ]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      name: row.name,
      code: row.course_code,
      description: row.description,
      department: row.department,
      credits: row.credits,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }, 'Subject created successfully', 201);
  } catch (error) {
    console.error('Create subject error:', error);
    sendError(res, 'Failed to create subject', 500);
  }
};

const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (req.body.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(req.body.name);
    }
    if (req.body.code !== undefined) {
      updates.push(`course_code = $${paramCount++}`);
      values.push(req.body.code);
    }
    if (req.body.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(req.body.description);
    }
    if (req.body.department !== undefined) {
      updates.push(`department = $${paramCount++}`);
      values.push(req.body.department);
    }
    if (req.body.credits !== undefined) {
      updates.push(`credits = $${paramCount++}`);
      values.push(req.body.credits);
    }

    if (updates.length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    values.push(id);
    const query = `UPDATE courses SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return sendError(res, 'Subject not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      name: row.name,
      code: row.course_code,
      description: row.description,
      department: row.department,
      credits: row.credits,
      updatedAt: row.updated_at
    }, 'Subject updated successfully');
  } catch (error) {
    console.error('Update subject error:', error);
    sendError(res, 'Failed to update subject', 500);
  }
};

const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM courses WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return sendError(res, 'Subject not found', 404);
    }

    sendSuccess(res, null, 'Subject deleted successfully');
  } catch (error) {
    console.error('Delete subject error:', error);
    sendError(res, 'Failed to delete subject', 500);
  }
};

module.exports = {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject
};
