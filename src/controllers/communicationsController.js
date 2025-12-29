const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

// Messages
const getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 10, unread } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user.id;

    let query = `
      SELECT m.*, 
             s.name as sender_name, s.role as sender_role,
             r.name as recipient_name, r.role as recipient_role
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.recipient_id = r.id
      WHERE m.recipient_id = $1
    `;
    const params = [userId];
    let paramCount = 2;

    if (unread === 'true') {
      query += ` AND m.read = false`;
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM messages WHERE recipient_id = $1', [userId]);
    const total = parseInt(countResult.rows[0].count);

    const messages = result.rows.map(row => ({
      id: row.id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      senderRole: row.sender_role,
      recipientId: row.recipient_id,
      recipientName: row.recipient_name,
      recipientRole: row.recipient_role,
      subject: row.subject,
      content: row.content,
      read: row.read,
      createdAt: row.created_at
    }));

    sendPaginated(res, messages, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get messages error:', error);
    sendError(res, 'Failed to fetch messages', 500);
  }
};

const sendMessage = async (req, res) => {
  try {
    const { recipientId, recipientIds, classId, section, subject, content } = req.body;
    const senderId = req.user.id;

    if (!subject || !content) {
      return sendError(res, 'Subject and content are required', 400);
    }

    let recipientUserIds = [];

    // If specific recipient IDs provided
    if (recipientIds && Array.isArray(recipientIds) && recipientIds.length > 0) {
      recipientUserIds = recipientIds;
    }
    // If single recipient ID provided
    else if (recipientId) {
      recipientUserIds = [recipientId];
    }
    // If class and/or section provided
    else if (classId) {
      let query = `
        SELECT DISTINCT u.id
        FROM students s
        JOIN users u ON u.email = s.email
        JOIN classes c ON s.class_id = c.id
        WHERE u.role = 'student' AND s.status = 'active'
      `;
      const params = [];
      let paramCount = 1;

      // If section is provided, find all classes with matching base name and section
      if (section) {
        // Get the base class name from the selected class
        // Filter by class and section (section is on students table now)
        query += ` AND s.class_id = $${paramCount} AND s.section = $${paramCount + 1}`;
        params.push(classId, section);
        paramCount += 2;
      } else {
        // Just send to the selected class
        query += ` AND s.class_id = $${paramCount}`;
        params.push(classId);
      }

      const studentsResult = await pool.query(query, params);
      recipientUserIds = studentsResult.rows.map(row => row.id);

      if (recipientUserIds.length === 0) {
        return sendError(res, 'No students found for the selected class/section', 404);
      }
    } else {
      return sendError(res, 'Either recipientId, recipientIds, or classId must be provided', 400);
    }

    // Create messages for all recipients
    const messages = [];
    await pool.query('BEGIN');

    for (const userId of recipientUserIds) {
      const messageId = uuidv4();
      const result = await pool.query(
        `INSERT INTO messages (id, sender_id, recipient_id, subject, content)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [messageId, senderId, userId, subject, content]
      );
      messages.push({
        id: result.rows[0].id,
        senderId: result.rows[0].sender_id,
        recipientId: result.rows[0].recipient_id,
        subject: result.rows[0].subject,
        content: result.rows[0].content,
        read: result.rows[0].read,
        createdAt: result.rows[0].created_at
      });
    }

    await pool.query('COMMIT');

    sendSuccess(res, {
      messages,
      count: messages.length
    }, `Message sent successfully to ${messages.length} recipient(s)`, 201);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Send message error:', error);
    sendError(res, 'Failed to send message', 500);
  }
};

const markMessageAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('UPDATE messages SET read = true WHERE id = $1', [id]);

    sendSuccess(res, null, 'Message marked as read');
  } catch (error) {
    console.error('Mark message as read error:', error);
    sendError(res, 'Failed to mark message as read', 500);
  }
};

// Get students for messaging (with user IDs)
const getStudentsForMessaging = async (req, res) => {
  try {
    const { classId, section } = req.query;

    if (!classId) {
      return sendError(res, 'classId is required', 400);
    }

    let query = `
      SELECT DISTINCT s.id as student_id, s.first_name, s.last_name, s.email,
             s.student_id as student_number, c.name as class_name, s.section,
             u.id as user_id
      FROM students s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN users u ON u.email = s.email AND u.role = 'student'
      WHERE s.class_id = $1 AND s.status = 'active'
    `;
    const params = [classId];

    if (section) {
      query += ` AND s.section = $2`;
      params.push(section);
    }

    query += ` ORDER BY s.first_name, s.last_name`;

    const result = await pool.query(query, params);

    const students = result.rows.map(row => ({
      id: row.student_id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      studentId: row.student_number,
      className: row.class_name,
      section: row.section,
      fullName: `${row.first_name} ${row.last_name}`
    }));

    sendSuccess(res, students);
  } catch (error) {
    console.error('Get students for messaging error:', error);
    sendError(res, 'Failed to fetch students', 500);
  }
};

// Announcements
const getAnnouncements = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT a.*, u.name as author_name
       FROM announcements a
       JOIN users u ON a.author_id = u.id
       WHERE (a.expires_at IS NULL OR a.expires_at > NOW())
       ORDER BY a.published_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM announcements WHERE expires_at IS NULL OR expires_at > NOW()');
    const total = parseInt(countResult.rows[0].count);

    const announcements = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      authorId: row.author_id,
      authorName: row.author_name,
      targetAudience: row.target_audience,
      priority: row.priority,
      publishedAt: row.published_at,
      expiresAt: row.expires_at,
      attachments: row.attachments,
      createdAt: row.created_at
    }));

    sendPaginated(res, announcements, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    sendError(res, 'Failed to fetch announcements', 500);
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const { title, content, targetAudience, priority } = req.body;
    const authorId = req.user.id;

    const result = await pool.query(
      `INSERT INTO announcements (id, title, content, author_id, target_audience, priority)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [uuidv4(), title, content, authorId, targetAudience, priority]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      title: row.title,
      content: row.content,
      authorId: row.author_id,
      targetAudience: row.target_audience,
      priority: row.priority,
      publishedAt: row.published_at,
      createdAt: row.created_at
    }, 'Announcement created successfully', 201);
  } catch (error) {
    console.error('Create announcement error:', error);
    sendError(res, 'Failed to create announcement', 500);
  }
};

// Events
const getEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT e.*, u.name as organizer_name
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND e.start_date >= $${paramCount++}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND e.end_date <= $${paramCount++}`;
      params.push(endDate);
    }

    query += ` ORDER BY e.start_date ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM events');
    const total = parseInt(countResult.rows[0].count);

    const events = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      location: row.location,
      organizerId: row.organizer_id,
      organizerName: row.organizer_name,
      targetAudience: row.target_audience,
      createdAt: row.created_at
    }));

    sendPaginated(res, events, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get events error:', error);
    sendError(res, 'Failed to fetch events', 500);
  }
};

const createEvent = async (req, res) => {
  try {
    const { title, description, startDate, endDate, location, targetAudience } = req.body;
    const organizerId = req.user.id;

    const result = await pool.query(
      `INSERT INTO events (id, title, description, start_date, end_date, location, organizer_id, target_audience)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [uuidv4(), title, description, startDate, endDate, location, organizerId, targetAudience]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      title: row.title,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      location: row.location,
      organizerId: row.organizer_id,
      targetAudience: row.target_audience,
      createdAt: row.created_at
    }, 'Event created successfully', 201);
  } catch (error) {
    console.error('Create event error:', error);
    sendError(res, 'Failed to create event', 500);
  }
};

const updateEvent = async (req, res) => {
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
    const query = `UPDATE events SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return sendError(res, 'Event not found', 404);
    }

    sendSuccess(res, result.rows[0], 'Event updated successfully');
  } catch (error) {
    console.error('Update event error:', error);
    sendError(res, 'Failed to update event', 500);
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return sendError(res, 'Event not found', 404);
    }

    sendSuccess(res, null, 'Event deleted successfully');
  } catch (error) {
    console.error('Delete event error:', error);
    sendError(res, 'Failed to delete event', 500);
  }
};

module.exports = {
  getMessages,
  sendMessage,
  markMessageAsRead,
  getStudentsForMessaging,
  getAnnouncements,
  createAnnouncement,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent
};

