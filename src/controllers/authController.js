const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

const register = async (req, res) => {
  try {
    const { email, password, name, role = 'staff' } = req.body;

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return sendError(res, 'User with this email already exists', 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    // Create user
    const result = await pool.query(
      `INSERT INTO users (id, email, password, name, role, active, created_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       RETURNING id, email, name, role, created_at`,
      [id, email, hashedPassword, name, role]
    );

    const user = result.rows[0];
    const { token, refreshToken } = generateTokens(user.id);

    sendSuccess(res, {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.created_at
      }
    }, 'User registered successfully', 201);
  } catch (error) {
    console.error('Register error:', error);
    sendError(res, 'Registration failed', 500);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verify database connection and schema
    const dbCheck = await pool.query('SELECT current_database() as db, (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\' AND table_name = \'users\') as users_exists');
    console.log(`[Login] Connected to DB: ${dbCheck.rows[0].db}, Users table exists: ${dbCheck.rows[0].users_exists > 0}`);

    // Find user
    const result = await pool.query(
      'SELECT id, email, password, name, role, active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Invalid email or password', 401);
    }

    const user = result.rows[0];

    if (!user.active) {
      return sendError(res, 'Account is inactive', 403);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Generate tokens
    const { token, refreshToken } = generateTokens(user.id);

    sendSuccess(res, {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.created_at
      }
    }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, 'Login failed', 500);
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, 'Refresh token required', 400);
    }

    const decoded = verifyRefreshToken(refreshToken);
    const { token } = generateTokens(decoded.userId);

    sendSuccess(res, { token }, 'Token refreshed successfully');
  } catch (error) {
    sendError(res, 'Invalid or expired refresh token', 401);
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, avatar, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const user = result.rows[0];
    sendSuccess(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Get current user error:', error);
    sendError(res, 'Failed to fetch user', 500);
  }
};

const logout = async (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // But we can add token blacklisting here if needed
  sendSuccess(res, null, 'Logged out successfully');
};

const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user.id;

    // Check if email is being changed and if it's already taken
    if (email) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (existingUser.rows.length > 0) {
        return sendError(res, 'Email is already in use', 400);
      }
    }

    // Update user
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (name) {
      updateFields.push(`name = $${paramCount}`);
      updateValues.push(name);
      paramCount++;
    }

    if (email) {
      updateFields.push(`email = $${paramCount}`);
      updateValues.push(email);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, name, role, avatar, created_at, updated_at
    `;

    const result = await pool.query(query, updateValues);

    if (result.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const user = result.rows[0];
    sendSuccess(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }, 'Profile updated successfully');
  } catch (error) {
    console.error('Update profile error:', error);
    sendError(res, 'Failed to update profile', 500);
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return sendError(res, 'Current password and new password are required', 400);
    }

    if (newPassword.length < 6) {
      return sendError(res, 'New password must be at least 6 characters', 400);
    }

    // Get current user
    const userResult = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!isValidPassword) {
      return sendError(res, 'Current password is incorrect', 401);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, userId]
    );

    sendSuccess(res, null, 'Password updated successfully');
  } catch (error) {
    console.error('Change password error:', error);
    sendError(res, 'Failed to change password', 500);
  }
};

module.exports = {
  register,
  login,
  refresh,
  getCurrentUser,
  logout,
  updateProfile,
  changePassword
};

