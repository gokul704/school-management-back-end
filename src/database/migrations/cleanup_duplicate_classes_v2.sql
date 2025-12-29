-- Clean up duplicate classes - Version 2 (handles foreign keys)
-- Remove classes that have section information in the name (e.g., "Class 9-A")
-- Keep only classes with numeric names (e.g., "6", "7", "8", "9")

-- Step 1: Update students to point to the correct numeric class
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
  AND c1.name ~ '^Class\s+\d+'
  AND EXISTS (
    SELECT 1 FROM classes c2
    WHERE c2.name = REGEXP_REPLACE(c1.name, '^Class\s+(\d+).*$', '\1', 'g')
      AND c2.academic_year = c1.academic_year
  );

-- Step 2: Update timetables to point to correct numeric class
UPDATE timetables t
SET class_id = (
  SELECT c2.id
  FROM classes c2
  WHERE c2.name = REGEXP_REPLACE(c1.name, '^Class\s+(\d+).*$', '\1', 'g')
    AND c2.academic_year = c1.academic_year
  LIMIT 1
)
FROM classes c1
WHERE t.class_id = c1.id
  AND c1.name ~ '^Class\s+\d+'
  AND EXISTS (
    SELECT 1 FROM classes c2
    WHERE c2.name = REGEXP_REPLACE(c1.name, '^Class\s+(\d+).*$', '\1', 'g')
      AND c2.academic_year = c1.academic_year
  );

-- Step 3: Update class_courses to point to correct numeric class
UPDATE class_courses cc
SET class_id = (
  SELECT c2.id
  FROM classes c2
  WHERE c2.name = REGEXP_REPLACE(c1.name, '^Class\s+(\d+).*$', '\1', 'g')
    AND c2.academic_year = c1.academic_year
  LIMIT 1
)
FROM classes c1
WHERE cc.class_id = c1.id
  AND c1.name ~ '^Class\s+\d+'
  AND EXISTS (
    SELECT 1 FROM classes c2
    WHERE c2.name = REGEXP_REPLACE(c1.name, '^Class\s+(\d+).*$', '\1', 'g')
      AND c2.academic_year = c1.academic_year
  );

-- Step 4: Now delete classes that have "Class" prefix or section information in the name
DELETE FROM classes
WHERE name ~ '^Class\s+\d+' 
   OR name ~ '^Class\s+\d+-[A-Z]'
   OR name ~ '^Class\s+\d+\s+[A-Z]';

-- Step 5: Ensure we have unique classes by name and academic_year
-- Keep the one with the most students if duplicates exist
DELETE FROM classes c1
WHERE EXISTS (
  SELECT 1
  FROM classes c2
  LEFT JOIN students s2 ON s2.class_id = c2.id
  LEFT JOIN students s1 ON s1.class_id = c1.id
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

