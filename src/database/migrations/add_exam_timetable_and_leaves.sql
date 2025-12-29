-- Exam Halls/Classrooms Configuration
CREATE TABLE IF NOT EXISTS exam_halls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    capacity INTEGER NOT NULL,
    building VARCHAR(255),
    floor VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exam Timetable (separate from regular timetable)
CREATE TABLE IF NOT EXISTS exam_timetables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    exam_hall_id UUID NOT NULL REFERENCES exam_halls(id),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    invigilator_id UUID REFERENCES teachers(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student to Exam Hall Assignment
CREATE TABLE IF NOT EXISTS exam_student_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_timetable_id UUID NOT NULL REFERENCES exam_timetables(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id),
    seat_number VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exam_timetable_id, student_id)
);

-- Teacher Leaves
CREATE TABLE IF NOT EXISTS teacher_leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id),
    leave_type VARCHAR(50) NOT NULL CHECK (leave_type IN ('sick', 'casual', 'personal', 'emergency', 'other')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_exam_timetables_exam ON exam_timetables(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_timetables_hall ON exam_timetables(exam_hall_id);
CREATE INDEX IF NOT EXISTS idx_exam_timetables_date ON exam_timetables(date);
CREATE INDEX IF NOT EXISTS idx_exam_student_assignments_timetable ON exam_student_assignments(exam_timetable_id);
CREATE INDEX IF NOT EXISTS idx_exam_student_assignments_student ON exam_student_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_leaves_teacher ON teacher_leaves(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_leaves_status ON teacher_leaves(status);
CREATE INDEX IF NOT EXISTS idx_teacher_leaves_dates ON teacher_leaves(start_date, end_date);

