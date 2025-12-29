-- Remove semester from courses table
ALTER TABLE courses DROP COLUMN IF EXISTS semester;

-- Remove semester from academic_records table
ALTER TABLE academic_records DROP COLUMN IF EXISTS semester;

-- Remove semester from timetables table
ALTER TABLE timetables DROP COLUMN IF EXISTS semester;

-- Create grades table for subject-wise and class-level grades
CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL,
    grade VARCHAR(10) NOT NULL, -- A+, A, B+, B, C+, C, D, F or percentage
    marks_obtained DECIMAL(10, 2),
    max_marks DECIMAL(10, 2),
    exam_type VARCHAR(50) DEFAULT 'final' CHECK (exam_type IN ('unit_test', 'mid_term', 'final', 'assignment', 'project', 'practical', 'other')),
    exam_name VARCHAR(255),
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_course ON grades(course_id);
CREATE INDEX IF NOT EXISTS idx_grades_class ON grades(class_id);
CREATE INDEX IF NOT EXISTS idx_grades_academic_year ON grades(academic_year);
CREATE INDEX IF NOT EXISTS idx_grades_student_class_year ON grades(student_id, class_id, academic_year);

-- Add comment to explain the structure
COMMENT ON TABLE grades IS 'Stores subject-wise and class-level grades for students. Each grade entry represents a student''s performance in a subject for a specific class and academic year.';

