-- Clean up duplicate classes - Version 3 (safer approach)
-- This script removes classes with "Class X-Y" format and consolidates to numeric classes

-- Step 1: Create a mapping of old class IDs to new class IDs
-- For classes with "Class X-Y" format, map them to the numeric class "X"
DO $$
DECLARE
    class_record RECORD;
    numeric_class_id UUID;
    old_class_id UUID;
BEGIN
    -- Loop through all classes with "Class" prefix
    FOR class_record IN 
        SELECT id, name, academic_year 
        FROM classes 
        WHERE name ~ '^Class\s+\d+'
    LOOP
        -- Extract the numeric part (e.g., "9" from "Class 9-A")
        SELECT id INTO numeric_class_id
        FROM classes
        WHERE name = REGEXP_REPLACE(class_record.name, '^Class\s+(\d+).*$', '\1', 'g')
          AND academic_year = class_record.academic_year
        LIMIT 1;
        
        -- If numeric class exists, update all references
        IF numeric_class_id IS NOT NULL THEN
            -- Update students
            UPDATE students 
            SET class_id = numeric_class_id
            WHERE class_id = class_record.id;
            
            -- Update timetables
            UPDATE timetables 
            SET class_id = numeric_class_id
            WHERE class_id = class_record.id;
            
            -- Update class_courses (merge course mappings)
            INSERT INTO class_courses (id, class_id, course_id)
            SELECT uuid_generate_v4(), numeric_class_id, course_id
            FROM class_courses
            WHERE class_id = class_record.id
            ON CONFLICT DO NOTHING;
            
            -- Delete old class_courses entries
            DELETE FROM class_courses WHERE class_id = class_record.id;
            
            -- Now safe to delete the old class
            DELETE FROM classes WHERE id = class_record.id;
        END IF;
    END LOOP;
END $$;

-- Step 2: Remove duplicate numeric classes (keep the one with most students)
DELETE FROM classes c1
WHERE EXISTS (
    SELECT 1
    FROM classes c2
    WHERE c2.name = c1.name
      AND c2.academic_year = c1.academic_year
      AND c2.id != c1.id
      AND (
        (SELECT COUNT(*) FROM students WHERE class_id = c2.id) > 
        (SELECT COUNT(*) FROM students WHERE class_id = c1.id)
        OR (
          (SELECT COUNT(*) FROM students WHERE class_id = c2.id) = 
          (SELECT COUNT(*) FROM students WHERE class_id = c1.id)
          AND c2.id < c1.id
        )
      )
);

-- Step 3: Update remaining references for duplicate numeric classes
DO $$
DECLARE
    dup_record RECORD;
    keep_class_id UUID;
BEGIN
    -- Find duplicate classes and merge them
    FOR dup_record IN
        SELECT name, academic_year, array_agg(id ORDER BY id) as class_ids
        FROM classes
        GROUP BY name, academic_year
        HAVING COUNT(*) > 1
    LOOP
        -- Keep the first one (oldest)
        keep_class_id := dup_record.class_ids[1];
        
        -- Update all references to point to the kept class
        FOR i IN 2..array_length(dup_record.class_ids, 1) LOOP
            -- Update students
            UPDATE students 
            SET class_id = keep_class_id
            WHERE class_id = dup_record.class_ids[i];
            
            -- Update timetables
            UPDATE timetables 
            SET class_id = keep_class_id
            WHERE class_id = dup_record.class_ids[i];
            
            -- Merge class_courses
            INSERT INTO class_courses (id, class_id, course_id)
            SELECT uuid_generate_v4(), keep_class_id, course_id
            FROM class_courses
            WHERE class_id = dup_record.class_ids[i]
            ON CONFLICT DO NOTHING;
            
            -- Delete old class_courses
            DELETE FROM class_courses WHERE class_id = dup_record.class_ids[i];
            
            -- Delete duplicate class
            DELETE FROM classes WHERE id = dup_record.class_ids[i];
        END LOOP;
    END LOOP;
END $$;

