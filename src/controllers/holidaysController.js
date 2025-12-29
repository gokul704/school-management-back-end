const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

const getAll = async (req, res) => {
  try {
    const { startDate, endDate, type, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT h.*, u.name as created_by_name
      FROM holidays h
      LEFT JOIN users u ON h.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND h.end_date >= $${paramCount++}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND h.start_date <= $${paramCount++}`;
      params.push(endDate);
    }
    if (type) {
      query += ` AND h.holiday_type = $${paramCount++}`;
      params.push(type);
    }

    query += ` ORDER BY h.start_date ASC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM holidays');
    const total = parseInt(countResult.rows[0].count);

    const holidays = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      holidayType: row.holiday_type,
      isRecurring: row.is_recurring,
      recurringPattern: row.recurring_pattern,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    sendPaginated(res, holidays, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get all holidays error:', error);
    sendError(res, 'Failed to fetch holidays', 500);
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT h.*, u.name as created_by_name
       FROM holidays h
       LEFT JOIN users u ON h.created_by = u.id
       WHERE h.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Holiday not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      title: row.title,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      holidayType: row.holiday_type,
      isRecurring: row.is_recurring,
      recurringPattern: row.recurring_pattern,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Get holiday by id error:', error);
    sendError(res, 'Failed to fetch holiday', 500);
  }
};

const create = async (req, res) => {
  try {
    const { title, description, startDate, endDate, holidayType, isRecurring, recurringPattern } = req.body;

    if (!title || !startDate || !endDate) {
      return sendError(res, 'Title, start date, and end date are required', 400);
    }

    if (new Date(startDate) > new Date(endDate)) {
      return sendError(res, 'Start date must be before or equal to end date', 400);
    }

    const result = await pool.query(
      `INSERT INTO holidays (id, title, description, start_date, end_date, holiday_type, is_recurring, recurring_pattern, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [uuidv4(), title, description || null, startDate, endDate, holidayType || 'holiday', isRecurring || false, recurringPattern || null, req.user.id]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      title: row.title,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      holidayType: row.holiday_type,
      isRecurring: row.is_recurring,
      recurringPattern: row.recurring_pattern,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }, 'Holiday created successfully', 201);
  } catch (error) {
    console.error('Create holiday error:', error);
    sendError(res, 'Failed to create holiday', 500);
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, startDate, endDate, holidayType, isRecurring, recurringPattern } = req.body;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return sendError(res, 'Start date must be before or equal to end date', 400);
    }

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      params.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      params.push(description);
    }
    if (startDate !== undefined) {
      updates.push(`start_date = $${paramCount++}`);
      params.push(startDate);
    }
    if (endDate !== undefined) {
      updates.push(`end_date = $${paramCount++}`);
      params.push(endDate);
    }
    if (holidayType !== undefined) {
      updates.push(`holiday_type = $${paramCount++}`);
      params.push(holidayType);
    }
    if (isRecurring !== undefined) {
      updates.push(`is_recurring = $${paramCount++}`);
      params.push(isRecurring);
    }
    if (recurringPattern !== undefined) {
      updates.push(`recurring_pattern = $${paramCount++}`);
      params.push(recurringPattern);
    }

    if (updates.length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE holidays
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Holiday not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      title: row.title,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      holidayType: row.holiday_type,
      isRecurring: row.is_recurring,
      recurringPattern: row.recurring_pattern,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }, 'Holiday updated successfully');
  } catch (error) {
    console.error('Update holiday error:', error);
    sendError(res, 'Failed to update holiday', 500);
  }
};

const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM holidays WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return sendError(res, 'Holiday not found', 404);
    }

    sendSuccess(res, null, 'Holiday deleted successfully');
  } catch (error) {
    console.error('Delete holiday error:', error);
    sendError(res, 'Failed to delete holiday', 500);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: deleteHoliday,
};

