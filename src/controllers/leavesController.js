const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');
const { createForAdmins } = require('./notificationsController');

const getLeaves = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, teacherId } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT tl.*, t.first_name || ' ' || t.last_name as teacher_name, t.teacher_id,
             u.name as reviewer_name
      FROM teacher_leaves tl
      JOIN teachers t ON tl.teacher_id = t.id
      LEFT JOIN users u ON tl.reviewed_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // If not admin, only show their own leaves
    if (req.user.role !== 'admin' && req.user.role !== 'principal') {
      const teacherResult = await pool.query('SELECT id FROM teachers WHERE email = $1', [req.user.email]);
      if (teacherResult.rows.length > 0) {
        query += ` AND tl.teacher_id = $${paramCount++}`;
        params.push(teacherResult.rows[0].id);
      } else {
        // If user is not a teacher, return empty
        return sendPaginated(res, [], {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0
        });
      }
    } else if (teacherId) {
      query += ` AND tl.teacher_id = $${paramCount++}`;
      params.push(teacherId);
    }

    if (status) {
      query += ` AND tl.status = $${paramCount++}`;
      params.push(status);
    }

    query += ` ORDER BY tl.applied_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    // Build count query separately
    let countQuery = `
      SELECT COUNT(*) as count
      FROM teacher_leaves tl
      JOIN teachers t ON tl.teacher_id = t.id
      WHERE 1=1
    `;
    const countParams = [];
    let countParamCount = 1;

    // Apply same filters for count
    if (req.user.role !== 'admin' && req.user.role !== 'principal') {
      const teacherResult = await pool.query('SELECT id FROM teachers WHERE email = $1', [req.user.email]);
      if (teacherResult.rows.length > 0) {
        countQuery += ` AND tl.teacher_id = $${countParamCount++}`;
        countParams.push(teacherResult.rows[0].id);
      } else {
        return sendPaginated(res, [], {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0
        });
      }
    } else if (teacherId) {
      countQuery += ` AND tl.teacher_id = $${countParamCount++}`;
      countParams.push(teacherId);
    }

    if (status) {
      countQuery += ` AND tl.status = $${countParamCount++}`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const leaves = result.rows.map(row => ({
      id: row.id,
      teacherId: row.teacher_id,
      teacherName: row.teacher_name,
      teacherCode: row.teacher_id,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      status: row.status,
      appliedAt: row.applied_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
      reviewerName: row.reviewer_name,
      reviewNotes: row.review_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    sendPaginated(res, leaves, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get leaves error:', error);
    sendError(res, 'Failed to fetch leaves', 500);
  }
};

const createLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;

    // Get teacher ID from user email
    const teacherResult = await pool.query('SELECT id FROM teachers WHERE email = $1', [req.user.email]);
    if (teacherResult.rows.length === 0) {
      return sendError(res, 'Teacher not found', 404);
    }

    const teacherId = teacherResult.rows[0].id;

    // Check for overlapping leaves
    const overlapCheck = await pool.query(
      `SELECT id FROM teacher_leaves
       WHERE teacher_id = $1
       AND status IN ('pending', 'approved')
       AND (
         (start_date <= $2 AND end_date >= $2)
         OR (start_date <= $3 AND end_date >= $3)
         OR (start_date >= $2 AND end_date <= $3)
       )`,
      [teacherId, startDate, endDate]
    );

    if (overlapCheck.rows.length > 0) {
      return sendError(res, 'You already have a leave request for this period', 400);
    }

    const result = await pool.query(
      `INSERT INTO teacher_leaves (id, teacher_id, leave_type, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [uuidv4(), teacherId, leaveType, startDate, endDate, reason]
    );

    const row = result.rows[0];
    
    // Get teacher name for notification
    const teacherNameResult = await pool.query(
      'SELECT first_name || \' \' || last_name as name FROM teachers WHERE id = $1',
      [teacherId]
    );
    const teacherName = teacherNameResult.rows[0]?.name || 'A teacher';

    // Create notification for all admins/principals
    await createForAdmins(
      'New Leave Application',
      `${teacherName} has applied for ${row.leave_type} leave from ${row.start_date} to ${row.end_date}`,
      'warning',
      `/dashboard/leaves?leaveId=${row.id}`
    );

    sendSuccess(res, {
      id: row.id,
      teacherId: row.teacher_id,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      status: row.status,
      appliedAt: row.applied_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }, 'Leave application submitted successfully', 201);
  } catch (error) {
    console.error('Create leave error:', error);
    sendError(res, 'Failed to submit leave application', 500);
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;

    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return sendError(res, 'Invalid status', 400);
    }

    // Only admin/principal can review
    if (req.user.role !== 'admin' && req.user.role !== 'principal') {
      return sendError(res, 'Unauthorized', 403);
    }

    const result = await pool.query(
      `UPDATE teacher_leaves
       SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, review_notes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, req.user.id, reviewNotes || null, id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Leave not found', 404);
    }

    const row = result.rows[0];
    
    // Get teacher details for notification
    const teacherResult = await pool.query(
      `SELECT t.first_name || ' ' || t.last_name as name, u.id as user_id
       FROM teachers t
       JOIN users u ON u.email = t.email
       WHERE t.id = $1`,
      [row.teacher_id]
    );
    
    if (teacherResult.rows.length > 0) {
      const teacherName = teacherResult.rows[0].name;
      const teacherUserId = teacherResult.rows[0].user_id;
      
      // Create notification for the teacher
      await pool.query(
        `INSERT INTO notifications (id, user_id, title, message, type, link)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          uuidv4(),
          teacherUserId,
          'Leave Application ' + (status === 'approved' ? 'Approved' : 'Rejected'),
          `Your ${row.leave_type} leave application from ${row.start_date} to ${row.end_date} has been ${status === 'approved' ? 'approved' : 'rejected'}.${row.review_notes ? ' ' + row.review_notes : ''}`,
          status === 'approved' ? 'success' : 'error',
          '/dashboard/leaves'
        ]
      );
    }
    
    // Mark related notifications as read for the admin who reviewed
    await pool.query(
      `UPDATE notifications 
       SET read = true 
       WHERE link LIKE $1 AND read = false`,
      [`%/leaves?leaveId=${id}%`]
    );

    sendSuccess(res, {
      id: row.id,
      teacherId: row.teacher_id,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      status: row.status,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
      reviewNotes: row.review_notes,
      updatedAt: row.updated_at
    }, 'Leave status updated successfully');
  } catch (error) {
    console.error('Update leave status error:', error);
    sendError(res, 'Failed to update leave status', 500);
  }
};

const getLeaveById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT tl.*, t.first_name || ' ' || t.last_name as teacher_name, t.teacher_id,
             u.name as reviewer_name
      FROM teacher_leaves tl
      JOIN teachers t ON tl.teacher_id = t.id
      LEFT JOIN users u ON tl.reviewed_by = u.id
      WHERE tl.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Leave not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      teacherId: row.teacher_id,
      teacherName: row.teacher_name,
      teacherCode: row.teacher_id,
      leaveType: row.leave_type,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      status: row.status,
      appliedAt: row.applied_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
      reviewerName: row.reviewer_name,
      reviewNotes: row.review_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Get leave error:', error);
    sendError(res, 'Failed to fetch leave', 500);
  }
};

module.exports = {
  getLeaves,
  createLeave,
  updateLeaveStatus,
  getLeaveById,
};

