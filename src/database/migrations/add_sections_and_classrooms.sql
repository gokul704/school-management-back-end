-- Add section and capacity to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS section VARCHAR(10);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 40;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS classroom_name VARCHAR(255);

-- Add duration to timetable_slots (in minutes, default 45)
ALTER TABLE timetable_slots ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 45;

-- Add section to timetable_slots to link to class sections
ALTER TABLE timetable_slots ADD COLUMN IF NOT EXISTS section VARCHAR(10);

-- Create index for sections
CREATE INDEX IF NOT EXISTS idx_classes_section ON classes(section);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_section ON timetable_slots(section);

