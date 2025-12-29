-- Clean up duplicate classes
-- Remove classes that have section information in the name (e.g., "Class 9-A")
-- Keep only classes with numeric names (e.g., "6", "7", "8", "9")

-- First, update students to point to the correct numeric class
-- For each student in a "Class X-Y" class, find the corresponding numeric class
UPDATE students s
SET class_id = (
  SELECT c2.id
  FROM classes c2
  WHERE c2.name = REGEXP_REPLACE(c1.name, '^Class\s+(\d+).*$', '\1', 'g')
    AND c2.academic_year = c1.academic_year
  LIMIT 1
)
FROM classes c1
WHERE s.class_id = c1.id
  AND c1.name ~ '^Class\s+\d+';

-- Delete classes that have "Class" prefix or section information in the name
DELETE FROM classes
WHERE name ~ '^Class\s+\d+' 
   OR name ~ '^Class\s+\d+-[A-Z]'
   OR name ~ '^Class\s+\d+\s+[A-Z]';

-- Ensure we have unique classes by name and academic_year
-- Keep the oldest one if duplicates exist
DELETE FROM classes c1
WHERE EXISTS (
  SELECT 1
  FROM classes c2
  WHERE c2.name = c1.name
    AND c2.academic_year = c1.academic_year
    AND c2.id < c1.id
);

