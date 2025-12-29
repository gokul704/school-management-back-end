-- Class-Course mapping table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS class_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, course_id)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_class_courses_class ON class_courses(class_id);
CREATE INDEX IF NOT EXISTS idx_class_courses_course ON class_courses(course_id);

