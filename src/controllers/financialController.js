const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

// Fee Structures
const getFeeStructures = async (req, res) => {
  try {
    const { page = 1, limit = 10, academicYear } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM fee_structures WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (academicYear) {
      query += ` AND academic_year = $${paramCount++}`;
      params.push(academicYear);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM fee_structures');
    const total = parseInt(countResult.rows[0].count);

    const fees = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      amount: parseFloat(row.amount),
      feeType: row.fee_type,
      academicYear: row.academic_year,
      dueDate: row.due_date,
      applicableTo: row.applicable_to,
      classId: row.class_id,
      studentId: row.student_id,
      status: row.status,
      createdAt: row.created_at
    }));

    sendPaginated(res, fees, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get fee structures error:', error);
    sendError(res, 'Failed to fetch fee structures', 500);
  }
};

const createFeeStructure = async (req, res) => {
  try {
    const {
      name, description, amount, feeType, academicYear,
      dueDate, applicableTo, classId, studentId, status = 'active'
    } = req.body;

    const result = await pool.query(
      `INSERT INTO fee_structures (
        id, name, description, amount, fee_type, academic_year,
        due_date, applicable_to, class_id, student_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        uuidv4(), name, description, amount, feeType, academicYear,
        dueDate, applicableTo, classId, studentId, status
      ]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      name: row.name,
      description: row.description,
      amount: parseFloat(row.amount),
      feeType: row.fee_type,
      academicYear: row.academic_year,
      dueDate: row.due_date,
      applicableTo: row.applicable_to,
      status: row.status,
      createdAt: row.created_at
    }, 'Fee structure created successfully', 201);
  } catch (error) {
    console.error('Create fee structure error:', error);
    sendError(res, 'Failed to create fee structure', 500);
  }
};

const updateFeeStructure = async (req, res) => {
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
    const query = `UPDATE fee_structures SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return sendError(res, 'Fee structure not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      name: row.name,
      amount: parseFloat(row.amount),
      feeType: row.fee_type,
      status: row.status
    }, 'Fee structure updated successfully');
  } catch (error) {
    console.error('Update fee structure error:', error);
    sendError(res, 'Failed to update fee structure', 500);
  }
};

const deleteFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM fee_structures WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return sendError(res, 'Fee structure not found', 404);
    }

    sendSuccess(res, null, 'Fee structure deleted successfully');
  } catch (error) {
    console.error('Delete fee structure error:', error);
    sendError(res, 'Failed to delete fee structure', 500);
  }
};

// Payments
const getPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, studentId, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, s.first_name || ' ' || s.last_name as student_name,
             f.name as fee_name
      FROM payments p
      JOIN students s ON p.student_id = s.id
      JOIN fee_structures f ON p.fee_structure_id = f.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (studentId) {
      query += ` AND p.student_id = $${paramCount++}`;
      params.push(studentId);
    }
    if (status) {
      query += ` AND p.status = $${paramCount++}`;
      params.push(status);
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM payments');
    const total = parseInt(countResult.rows[0].count);

    const payments = result.rows.map(row => ({
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      feeStructureId: row.fee_structure_id,
      feeName: row.fee_name,
      amount: parseFloat(row.amount),
      paymentMethod: row.payment_method,
      transactionId: row.transaction_id,
      status: row.status,
      paidAt: row.paid_at,
      createdAt: row.created_at
    }));

    sendPaginated(res, payments, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get payments error:', error);
    sendError(res, 'Failed to fetch payments', 500);
  }
};

const createPayment = async (req, res) => {
  try {
    const { studentId, feeStructureId, amount, paymentMethod, transactionId } = req.body;

    const result = await pool.query(
      `INSERT INTO payments (
        id, student_id, fee_structure_id, amount, payment_method, transaction_id, status, paid_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'completed', NOW())
      RETURNING *`,
      [uuidv4(), studentId, feeStructureId, amount, paymentMethod, transactionId]
    );

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      studentId: row.student_id,
      feeStructureId: row.fee_structure_id,
      amount: parseFloat(row.amount),
      paymentMethod: row.payment_method,
      status: row.status,
      paidAt: row.paid_at
    }, 'Payment recorded successfully', 201);
  } catch (error) {
    console.error('Create payment error:', error);
    sendError(res, 'Failed to record payment', 500);
  }
};

const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.*, s.first_name || ' ' || s.last_name as student_name,
              f.name as fee_name
       FROM payments p
       JOIN students s ON p.student_id = s.id
       JOIN fee_structures f ON p.fee_structure_id = f.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Payment not found', 404);
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      feeStructureId: row.fee_structure_id,
      feeName: row.fee_name,
      amount: parseFloat(row.amount),
      paymentMethod: row.payment_method,
      transactionId: row.transaction_id,
      status: row.status,
      paidAt: row.paid_at,
      createdAt: row.created_at
    });
  } catch (error) {
    console.error('Get payment error:', error);
    sendError(res, 'Failed to fetch payment', 500);
  }
};

const getFinancialReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const paymentsResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        SUM(amount) FILTER (WHERE status = 'completed') as total_collected,
        SUM(amount) FILTER (WHERE status = 'pending') as total_pending,
        payment_method,
        COUNT(*) as method_count,
        SUM(amount) as method_amount
      FROM payments
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY payment_method`,
      [startDate, endDate]
    );

    const feeBreakdownResult = await pool.query(
      `SELECT f.fee_type, SUM(p.amount) as amount
       FROM payments p
       JOIN fee_structures f ON p.fee_structure_id = f.id
       WHERE p.status = 'completed' AND p.created_at BETWEEN $1 AND $2
       GROUP BY f.fee_type`,
      [startDate, endDate]
    );

    const totalRevenue = paymentsResult.rows.reduce((sum, row) => sum + parseFloat(row.total_collected || 0), 0);
    const totalPending = paymentsResult.rows.reduce((sum, row) => sum + parseFloat(row.total_pending || 0), 0);

    sendSuccess(res, {
      period: { start: startDate, end: endDate },
      totalRevenue,
      totalPending,
      totalCollected: totalRevenue,
      feeBreakdown: feeBreakdownResult.rows.map(row => ({
        feeType: row.fee_type,
        amount: parseFloat(row.amount)
      })),
      paymentMethods: paymentsResult.rows.map(row => ({
        method: row.payment_method,
        count: parseInt(row.method_count),
        amount: parseFloat(row.method_amount)
      }))
    });
  } catch (error) {
    console.error('Get financial report error:', error);
    sendError(res, 'Failed to generate report', 500);
  }
};

module.exports = {
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  getPayments,
  createPayment,
  getPaymentById,
  getFinancialReport
};

