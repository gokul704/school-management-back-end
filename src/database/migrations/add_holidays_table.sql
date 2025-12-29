-- Holidays/Calendar table for school holidays
CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    holiday_type VARCHAR(50) DEFAULT 'holiday' CHECK (holiday_type IN ('holiday', 'festival', 'exam', 'break', 'other')),
    is_recurring BOOLEAN DEFAULT false,
    recurring_pattern VARCHAR(50), -- 'yearly', 'monthly', etc.
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for date queries
CREATE INDEX IF NOT EXISTS idx_holidays_start_date ON holidays(start_date);
CREATE INDEX IF NOT EXISTS idx_holidays_end_date ON holidays(end_date);
CREATE INDEX IF NOT EXISTS idx_holidays_type ON holidays(holiday_type);

