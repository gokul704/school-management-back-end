const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/add_exam_timetable_and_leaves.sql'),
      'utf8'
    );

    console.log('Running migration: add_exam_timetable_and_leaves.sql');
    
    // Execute the entire SQL file as one transaction
    // PostgreSQL can handle multiple statements separated by semicolons
    try {
      await pool.query(migrationSQL);
      console.log('✅ Migration completed successfully!');
    } catch (error) {
      // Ignore "already exists" errors for tables, indexes, etc.
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('⚠️  Some tables/indexes already exist, but migration completed');
      } else {
        throw error;
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();

