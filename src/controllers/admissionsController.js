const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM admission_applications WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (status && status !== 'all') {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    query += ` ORDER BY submitted_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM admission_applications');
    const total = parseInt(countResult.rows[0].count);

    const applications = result.rows.map(row => ({
      id: row.id,
      applicationNumber: row.application_number,
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
      appliedClass: row.applied_class,
      academicYear: row.academic_year,
      status: row.status,
      notes: row.notes,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by
    }));

    sendPaginated(res, applications, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get all admissions error:', error);
    sendError(res, 'Failed to fetch applications', 500);
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT a.*, 
       COALESCE(json_agg(json_build_object(
         'id', d.id, 'type', d.type, 'fileName', d.file_name,
         'fileUrl', d.file_url, 'verified', d.verified, 'uploadedAt', d.uploaded_at
       )) FILTER (WHERE d.id IS NOT NULL), '[]') as documents
       FROM admission_applications a
       LEFT JOIN admission_documents d ON a.id = d.application_id
       WHERE a.id = $1
       GROUP BY a.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Application not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      applicationNumber: row.application_number,
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
      appliedClass: row.applied_class,
      academicYear: row.academic_year,
      status: row.status,
      documents: row.documents,
      notes: row.notes,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by
    });
  } catch (error) {
    console.error('Get admission error:', error);
    sendError(res, 'Failed to fetch application', 500);
  }
};

const create = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, dateOfBirth, gender,
      address, parentName, parentPhone, parentEmail,
      appliedClass, academicYear
    } = req.body;

    const applicationNumber = `APP${new Date().getFullYear()}${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

    const result = await pool.query(
      `INSERT INTO admission_applications (
        id, application_number, first_name, last_name, email, phone,
        date_of_birth, gender, address, parent_name, parent_phone,
        parent_email, applied_class, academic_year
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        uuidv4(), applicationNumber, firstName, lastName, email, phone,
        dateOfBirth, gender, address, parentName, parentPhone,
        parentEmail, appliedClass, academicYear
      ]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      applicationNumber: row.application_number,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      status: row.status,
      submittedAt: row.submitted_at
    }, 'Application submitted successfully', 201);
  } catch (error) {
    console.error('Create admission error:', error);
    sendError(res, 'Failed to submit application', 500);
  }
};

const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const result = await pool.query(
      `UPDATE admission_applications 
       SET status = $1, notes = $2, reviewed_at = NOW(), reviewed_by = $3
       WHERE id = $4
       RETURNING *`,
      [status, notes, req.user.id, id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Application not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      status: row.status,
      notes: row.notes,
      reviewedAt: row.reviewed_at
    }, 'Application status updated successfully');
  } catch (error) {
    console.error('Update status error:', error);
    sendError(res, 'Failed to update status', 500);
  }
};

const uploadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;
    const file = req.file;

    if (!file) {
      return sendError(res, 'File is required', 400);
    }

    const result = await pool.query(
      `INSERT INTO admission_documents (id, application_id, type, file_name, file_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [uuidv4(), id, type, file.filename, `/uploads/${file.filename}`]
    );

    sendSuccess(res, {
      id: result.rows[0].id,
      type: result.rows[0].type,
      fileName: result.rows[0].file_name,
      fileUrl: result.rows[0].file_url
    }, 'Document uploaded successfully', 201);
  } catch (error) {
    console.error('Upload document error:', error);
    sendError(res, 'Failed to upload document', 500);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  updateStatus,
  uploadDocument
};

