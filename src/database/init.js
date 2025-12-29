const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

const initDatabase = async () => {
  try {
    // Test connection first
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection established');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute the entire schema as one query
    // PostgreSQL can handle multiple statements separated by semicolons
    try {
      await pool.query(schema);
      console.log('✅ Database schema initialized successfully');
    } catch (error) {
      // Ignore "already exists" errors for tables, functions, etc.
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('✅ Database schema already exists, skipping creation');
      } else {
        // For other errors, try to continue - some statements might have failed
        console.warn('⚠️  Some schema statements may have failed:', error.message);
        console.log('✅ Continuing with initialization...');
      }
    }
    
    // Create default admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const { v4: uuidv4 } = require('uuid');

    try {
      await pool.query(
        `INSERT INTO users (id, email, password, name, role, active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (email) DO UPDATE SET password = $3, name = $4, role = $5`,
        [uuidv4(), 'admin@school.com', hashedPassword, 'Principal Ramesh Kumar', 'admin']
      );
      console.log('✅ Default admin user created (email: admin@school.com, password: admin123)');
    } catch (error) {
      if (error.code !== '23505') { // Ignore duplicate key error
        console.error('Error creating admin user:', error);
      }
    }
    
    console.log('\n💡 To populate with sample data, run: npm run seed');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    process.exit(1);
  }
};

initDatabase();
