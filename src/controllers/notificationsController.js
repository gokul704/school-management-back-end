const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 50, unreadOnly = false } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user.id;

    let query = `
      SELECT * FROM notifications
      WHERE user_id = $1
    `;
    const params = [userId];
    let paramCount = 2;

    if (unreadOnly === 'true') {
      query += ` AND read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM notifications WHERE user_id = $1`;
    const countParams = [userId];
    if (unreadOnly === 'true') {
      countQuery += ` AND read = false`;
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const notifications = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      message: row.message,
      type: row.type,
      read: row.read,
      link: row.link,
      createdAt: row.created_at
    }));

    sendPaginated(res, notifications, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    sendError(res, 'Failed to fetch notifications', 500);
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false',
      [userId]
    );

    sendSuccess(res, { count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get unread count error:', error);
    sendError(res, 'Failed to fetch unread count', 500);
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Notification not found', 404);
    }

    sendSuccess(res, { id: result.rows[0].id }, 'Notification marked as read');
  } catch (error) {
    console.error('Mark notification as read error:', error);
    sendError(res, 'Failed to mark notification as read', 500);
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
      [userId]
    );

    sendSuccess(res, null, 'All notifications marked as read');
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    sendError(res, 'Failed to mark all notifications as read', 500);
  }
};

const create = async (req, res) => {
  try {
    const { userId, title, message, type = 'info', link } = req.body;

    if (!userId || !title || !message) {
      return sendError(res, 'userId, title, and message are required', 400);
    }

    const result = await pool.query(
      `INSERT INTO notifications (id, user_id, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [uuidv4(), userId, title, message, type, link || null]
    );

    const notification = {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      title: result.rows[0].title,
      message: result.rows[0].message,
      type: result.rows[0].type,
      read: result.rows[0].read,
      link: result.rows[0].link,
      createdAt: result.rows[0].created_at
    };

    sendSuccess(res, notification, 'Notification created successfully', 201);
  } catch (error) {
    console.error('Create notification error:', error);
    sendError(res, 'Failed to create notification', 500);
  }
};

// Helper function to create notification for admins/principals
const createForAdmins = async (title, message, type = 'info', link = null) => {
  try {
    // Get all admin and principal users
    const adminUsers = await pool.query(
      'SELECT id FROM public.users WHERE role IN ($1, $2)',
      ['admin', 'principal']
    );

    // Create notification for each admin/principal
    const notifications = [];
    for (const user of adminUsers.rows) {
      const result = await pool.query(
        `INSERT INTO notifications (id, user_id, title, message, type, link)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [uuidv4(), user.id, title, message, type, link]
      );
      notifications.push(result.rows[0]);
    }

    return notifications;
  } catch (error) {
    console.error('Create notifications for admins error:', error);
    return [];
  }
};

// Export the helper function
module.exports.createForAdmins = createForAdmins;

module.exports = {
  getAll,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  create,
  createForAdmins
};

