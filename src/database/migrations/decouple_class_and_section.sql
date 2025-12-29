-- Decouple classes and sections
-- Classes are now just numbers (6, 7, 8, 9, etc.)
-- Sections are stored on students directly (A, B, C, D, etc.)

-- Add section column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS section VARCHAR(10);

-- Create index for section on students
CREATE INDEX IF NOT EXISTS idx_students_section ON students(section);

-- Update classes table: remove section column (we'll keep it for backward compatibility but won't use it)
-- Actually, let's keep the section column in classes for now but understand that:
-- - Classes table: name should be just the number (e.g., "6", "7", "8", "9")
-- - Students table: section column stores the section (A, B, C, D)
-- - When displaying: "Class 6, Section A" means student is in class_id pointing to "Class 6" and has section "A"

-- Add comment to clarify the structure
COMMENT ON COLUMN students.section IS 'Section of the student (A, B, C, D, etc.). Combined with class_id, represents the student''s class and section.';
COMMENT ON COLUMN classes.name IS 'Class name should be just the grade number (e.g., "6", "7", "8", "9"). Display format: "Class {name}, Section {student.section}"';

