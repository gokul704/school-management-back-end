const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

const getSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM school_settings ORDER BY setting_key');
    
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = {
        value: row.setting_value,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by
      };
    });

    sendSuccess(res, settings);
  } catch (error) {
    console.error('Get settings error:', error);
    sendError(res, 'Failed to fetch settings', 500);
  }
};

const getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM school_settings WHERE setting_key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Setting not found', 404);
    }

    sendSuccess(res, {
      key: result.rows[0].setting_key,
      value: result.rows[0].setting_value,
      updatedAt: result.rows[0].updated_at,
      updatedBy: result.rows[0].updated_by
    });
  } catch (error) {
    console.error('Get setting error:', error);
    sendError(res, 'Failed to fetch setting', 500);
  }
};

const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    // Check if setting exists
    const existing = await pool.query(
      'SELECT id FROM school_settings WHERE setting_key = $1',
      [key]
    );

    if (existing.rows.length === 0) {
      // Create new setting
      const result = await pool.query(
        `INSERT INTO school_settings (id, setting_key, setting_value, updated_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [uuidv4(), key, value, req.user.id]
      );

      sendSuccess(res, {
        key: result.rows[0].setting_key,
        value: result.rows[0].setting_value,
        updatedAt: result.rows[0].updated_at,
        updatedBy: result.rows[0].updated_by
      }, 'Setting created successfully', 201);
    } else {
      // Update existing setting
      const result = await pool.query(
        `UPDATE school_settings
         SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE setting_key = $3
         RETURNING *`,
        [value, req.user.id, key]
      );

      sendSuccess(res, {
        key: result.rows[0].setting_key,
        value: result.rows[0].setting_value,
        updatedAt: result.rows[0].updated_at,
        updatedBy: result.rows[0].updated_by
      }, 'Setting updated successfully');
    }
  } catch (error) {
    console.error('Update setting error:', error);
    sendError(res, 'Failed to update setting', 500);
  }
};

const uploadLogo = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return sendError(res, 'Logo file is required', 400);
    }

    // Validate it's an image
    if (!file.mimetype.startsWith('image/')) {
      return sendError(res, 'File must be an image', 400);
    }

    const logoUrl = `/uploads/${file.filename}`;

    // Update or create logo setting
    const existing = await pool.query(
      'SELECT id FROM school_settings WHERE setting_key = $1',
      ['logo_url']
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO school_settings (id, setting_key, setting_value, updated_by)
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), 'logo_url', logoUrl, req.user.id]
      );
    } else {
      await pool.query(
        `UPDATE school_settings
         SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE setting_key = $3`,
        [logoUrl, req.user.id, 'logo_url']
      );
    }

    sendSuccess(res, {
      logoUrl,
      message: 'Logo uploaded successfully'
    }, 'Logo uploaded successfully', 201);
  } catch (error) {
    console.error('Upload logo error:', error);
    sendError(res, 'Failed to upload logo', 500);
  }
};

module.exports = {
  getSettings,
  getSetting,
  updateSetting,
  uploadLogo,
};

