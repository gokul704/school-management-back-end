-- Remove semester from all tables
-- This migration removes semester columns that may still exist in the database

-- Remove semester from courses table (if exists)
ALTER TABLE courses DROP COLUMN IF EXISTS semester;

-- Remove semester from academic_records table (if exists)
ALTER TABLE academic_records DROP COLUMN IF EXISTS semester;

-- Remove semester from timetables table (if exists)
ALTER TABLE timetables DROP COLUMN IF EXISTS semester;

