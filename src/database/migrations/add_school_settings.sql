-- School Settings table for storing logo and other school-wide settings
CREATE TABLE IF NOT EXISTS school_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO school_settings (setting_key, setting_value)
VALUES ('logo_url', NULL)
ON CONFLICT (setting_key) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_school_settings_key ON school_settings(setting_key);

