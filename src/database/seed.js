const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// South Indian names and data
const southIndianData = {
  firstNames: {
    male: ['Arjun', 'Karthik', 'Rahul', 'Suresh', 'Vikram', 'Rajesh', 'Mohan', 'Srinivas', 'Prakash', 'Naveen', 'Ramesh', 'Kumar', 'Siddharth', 'Aditya', 'Ganesh'],
    female: ['Priya', 'Lakshmi', 'Meera', 'Anjali', 'Divya', 'Shreya', 'Kavya', 'Sneha', 'Aishwarya', 'Deepika', 'Radha', 'Saranya', 'Nithya', 'Swathi', 'Pooja']
  },
  lastNames: ['Kumar', 'Reddy', 'Rao', 'Naidu', 'Iyer', 'Menon', 'Nair', 'Pillai', 'Sharma', 'Patel', 'Gowda', 'Shetty', 'Murthy', 'Venkatesh', 'Krishnan'],
  cities: ['Chennai', 'Bangalore', 'Hyderabad', 'Coimbatore', 'Madurai', 'Vijayawada', 'Tirupati', 'Mysore', 'Salem', 'Trichy'],
  states: ['Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Kerala'],
  qualifications: ['M.Sc Mathematics', 'M.A English', 'B.Ed', 'M.Sc Physics', 'M.A History', 'B.Sc Chemistry', 'M.Com', 'M.Sc Computer Science', 'Ph.D Physics', 'M.A Tamil'],
  specializations: ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'History', 'Geography', 'Economics', 'Tamil', 'Hindi', 'Sanskrit'],
  courses: [
    { code: 'MATH101', name: 'Mathematics - Algebra', department: 'Mathematics', credits: 4 },
    { code: 'ENG101', name: 'English Literature', department: 'English', credits: 3 },
    { code: 'PHY101', name: 'Physics - Mechanics', department: 'Physics', credits: 4 },
    { code: 'CHE101', name: 'Chemistry - Organic', department: 'Chemistry', credits: 4 },
    { code: 'BIO101', name: 'Biology - Botany', department: 'Biology', credits: 4 },
    { code: 'CS101', name: 'Computer Science Fundamentals', department: 'Computer Science', credits: 3 },
    { code: 'HIS101', name: 'Indian History', department: 'History', credits: 3 },
    { code: 'TAM101', name: 'Tamil Language', department: 'Languages', credits: 2 },
    { code: 'ECO101', name: 'Economics - Micro', department: 'Economics', credits: 3 },
    { code: 'GEO101', name: 'Geography', department: 'Geography', credits: 3 }
  ]
};

const generateStudentId = (index) => {
  const year = new Date().getFullYear();
  return `STU${year}${String(index).padStart(4, '0')}`;
};

const generateTeacherId = (index) => {
  return `TCH${String(index).padStart(4, '0')}`;
};

const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
const getRandomDate = (startYear, endYear) => {
  const year = Math.floor(Math.random() * (endYear - startYear + 1)) + startYear;
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Hash passwords
    const passwordHash = await bcrypt.hash('password123', 10);

    // Create users
    const users = [
      { email: 'admin@school.com', name: 'Principal Ramesh Kumar', role: 'admin', password: passwordHash },
      { email: 'teacher1@school.com', name: 'Dr. Lakshmi Iyer', role: 'teacher', password: passwordHash },
      { email: 'teacher2@school.com', name: 'Prof. Suresh Reddy', role: 'teacher', password: passwordHash },
      { email: 'teacher3@school.com', name: 'Ms. Priya Menon', role: 'teacher', password: passwordHash },
      { email: 'staff@school.com', name: 'Rajesh Nair', role: 'staff', password: passwordHash },
    ];

    console.log('👥 Creating users...');
    const userIds = {};
    for (const user of users) {
      const id = uuidv4();
      await pool.query(
        `INSERT INTO users (id, email, password, name, role, active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (email) DO UPDATE SET name = $4, role = $5`,
        [id, user.email, user.password, user.name, user.role]
      );
      userIds[user.email] = id;
      console.log(`   ✓ Created user: ${user.email} (${user.role})`);
    }

    // Create classes (just numbers: 6, 7, 8, 9, 10, 11, 12)
    console.log('📚 Creating classes...');
    const grades = ['6', '7', '8', '9', '10', '11', '12'];
    const classIds = {};
    
    for (const grade of grades) {
      const id = uuidv4();
      const className = grade; // Just the number, e.g., "6", "7", "8", "9", "10", "11", "12"
      const result = await pool.query(
        `INSERT INTO classes (id, name, academic_year, grade_level)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [id, className, '2024-2025', grade]
      );
      if (result.rows.length > 0) {
        classIds[grade] = result.rows[0].id;
        console.log(`   ✓ Created class: ${className}`);
      } else {
        // Class already exists, get its ID
        const existing = await pool.query('SELECT id FROM classes WHERE name = $1 AND academic_year = $2', [className, '2024-2025']);
        if (existing.rows.length > 0) {
          classIds[grade] = existing.rows[0].id;
          console.log(`   ✓ Using existing class: ${className}`);
        }
      }
    }

    // Create teachers
    console.log('👨‍🏫 Creating teachers...');
    const teacherData = [
      { firstName: 'Lakshmi', lastName: 'Iyer', email: 'lakshmi.iyer@school.com', qualification: 'Ph.D Mathematics', specialization: 'Mathematics', gender: 'female' },
      { firstName: 'Suresh', lastName: 'Reddy', email: 'suresh.reddy@school.com', qualification: 'M.A English', specialization: 'English', gender: 'male' },
      { firstName: 'Priya', lastName: 'Menon', email: 'priya.menon@school.com', qualification: 'M.Sc Physics', specialization: 'Physics', gender: 'female' },
      { firstName: 'Karthik', lastName: 'Rao', email: 'karthik.rao@school.com', qualification: 'M.Sc Chemistry', specialization: 'Chemistry', gender: 'male' },
      { firstName: 'Meera', lastName: 'Nair', email: 'meera.nair@school.com', qualification: 'M.Sc Biology', specialization: 'Biology', gender: 'female' },
      { firstName: 'Rahul', lastName: 'Kumar', email: 'rahul.kumar@school.com', qualification: 'M.Sc Computer Science', specialization: 'Computer Science', gender: 'male' },
      { firstName: 'Anjali', lastName: 'Sharma', email: 'anjali.sharma@school.com', qualification: 'M.A History', specialization: 'History', gender: 'female' },
      { firstName: 'Vikram', lastName: 'Naidu', email: 'vikram.naidu@school.com', qualification: 'M.A Tamil', specialization: 'Tamil', gender: 'male' },
    ];

    const teacherIds = {};
    for (let i = 0; i < teacherData.length; i++) {
      const teacher = teacherData[i];
      const id = uuidv4();
      const teacherId = generateTeacherId(i + 1);
      const hireDate = getRandomDate(2015, 2020);
      const dob = getRandomDate(1980, 1995);
      const city = getRandomElement(southIndianData.cities);
      const state = getRandomElement(southIndianData.states);

      const result = await pool.query(
        `INSERT INTO teachers (id, teacher_id, first_name, last_name, email, phone, date_of_birth, gender, address, qualification, specialization, hire_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
         ON CONFLICT (email) DO UPDATE SET first_name = $3, last_name = $4, phone = $6, date_of_birth = $7, gender = $8, address = $9, qualification = $10, specialization = $11, hire_date = $12, status = 'active'
         RETURNING id`,
        [
          id, teacherId, teacher.firstName, teacher.lastName, teacher.email,
          `+91${Math.floor(9000000000 + Math.random() * 1000000000)}`,
          dob, teacher.gender, `${city}, ${state}`, teacher.qualification,
          teacher.specialization, hireDate
        ]
      );
      
      // Get the actual ID from the database (either newly created or existing)
      if (result.rows.length > 0) {
        teacherIds[teacher.email] = result.rows[0].id;
        console.log(`   ✓ Created/Updated teacher: ${teacher.firstName} ${teacher.lastName}`);
      } else {
        // If no result, fetch the existing teacher ID
        const existing = await pool.query('SELECT id FROM teachers WHERE email = $1', [teacher.email]);
        if (existing.rows.length > 0) {
          teacherIds[teacher.email] = existing.rows[0].id;
          console.log(`   ✓ Using existing teacher: ${teacher.firstName} ${teacher.lastName}`);
        }
      }
    }

    // Create courses
    console.log('📖 Creating courses...');
    const courseIds = {};
    const teacherEmails = Object.keys(teacherIds);
    for (let i = 0; i < southIndianData.courses.length; i++) {
      const course = southIndianData.courses[i];
      const id = uuidv4();
      const teacherEmail = teacherEmails[i % teacherEmails.length];
      const teacherId = teacherIds[teacherEmail];

      const result = await pool.query(
        `INSERT INTO courses (id, course_code, name, description, credits, teacher_id, department, academic_year, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
         ON CONFLICT (course_code) DO UPDATE SET name = $3, description = $4, credits = $5, teacher_id = $6, department = $7, academic_year = $8
         RETURNING id`,
        [
          id, course.code, course.name, `Comprehensive course on ${course.name}`,
          course.credits, teacherId, course.department, '2024-2025'
        ]
      );
      
      // Get the actual ID from the database (either newly created or existing)
      if (result.rows.length > 0) {
        courseIds[course.code] = result.rows[0].id;
        console.log(`   ✓ Created/Updated course: ${course.code} - ${course.name}`);
      } else {
        // If no result, fetch the existing course ID
        const existing = await pool.query('SELECT id FROM courses WHERE course_code = $1', [course.code]);
        if (existing.rows.length > 0) {
          courseIds[course.code] = existing.rows[0].id;
          console.log(`   ✓ Using existing course: ${course.code} - ${course.name}`);
        }
      }
    }

    // Create students - distribute evenly across classes
    console.log('👨‍🎓 Creating students...');
    const gradeList = Object.keys(classIds); // Now contains grade numbers: "6", "7", "8", "9", "10", "11", "12"
    let studentIndex = 1;
    const studentsPerClass = 15; // ~15 students per class for better distribution
    const totalStudents = studentsPerClass * gradeList.length;

    for (let i = 0; i < totalStudents; i++) {
      const gender = Math.random() > 0.5 ? 'male' : 'female';
      const firstName = getRandomElement(southIndianData.firstNames[gender]);
      const lastName = getRandomElement(southIndianData.lastNames);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@school.com`;
      const studentId = generateStudentId(studentIndex++);
      const id = uuidv4();
      
      // Distribute students evenly across classes
      const gradeIndex = i % gradeList.length;
      const grade = gradeList[gradeIndex];
      const classId = classIds[grade];
      
      // Calculate DOB based on grade (older students for higher grades)
      const baseYear = 2006;
      const gradeNum = parseInt(grade);
      const dobYear = baseYear + (12 - gradeNum); // Grade 6 = 2012, Grade 12 = 2006
      const dob = getRandomDate(dobYear, dobYear + 1);
      const enrollmentDate = getRandomDate(2020, 2024);
      const city = getRandomElement(southIndianData.cities);
      const state = getRandomElement(southIndianData.states);
      const parentName = `${getRandomElement(southIndianData.firstNames[Math.random() > 0.5 ? 'male' : 'female'])} ${lastName}`;

      // Check if student already exists
      const existingStudent = await pool.query(
        'SELECT id FROM students WHERE student_id = $1 OR email = $2',
        [studentId, email]
      );
      
      if (existingStudent.rows.length === 0) {
        // Assign random section (A, B, or C)
        const section = getRandomElement(['A', 'B', 'C']);
        
        await pool.query(
          `INSERT INTO students (id, student_id, first_name, last_name, email, phone, date_of_birth, gender, address, parent_name, parent_phone, parent_email, enrollment_date, class_id, section, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active')`,
        [
          id, studentId, firstName, lastName, email,
          `+91${Math.floor(9000000000 + Math.random() * 1000000000)}`,
          dob, gender, `${city}, ${state}`, parentName,
          `+91${Math.floor(9000000000 + Math.random() * 1000000000)}`,
            `parent.${firstName.toLowerCase()}${i}@email.com`, enrollmentDate, classId, section
        ]
        );
      }
    }
    console.log(`   ✓ Created ${totalStudents} students distributed across ${gradeList.length} classes`);

    // Map courses to classes - map all courses to each class for comprehensive coverage
    console.log('🔗 Mapping courses to classes...');
    const courseCodesList = Object.keys(courseIds);
    let totalMappings = 0;
    
    // Map all courses to each class (or at least 7-8 courses per class)
    for (const grade of gradeList) {
      const classId = classIds[grade];
      const coursesToMap = Math.min(courseCodesList.length, 8); // Map up to 8 courses per class
      
      for (let i = 0; i < coursesToMap; i++) {
        const courseCode = courseCodesList[i];
        const courseId = courseIds[courseCode];
        const result = await pool.query(
          `INSERT INTO class_courses (id, class_id, course_id)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [uuidv4(), classId, courseId]
        );
        if (result.rows.length > 0) {
          totalMappings++;
        }
      }
    }
    console.log(`   ✓ Mapped ${totalMappings} course-class relationships across ${gradeList.length} classes`);

    // Create some attendance records
    console.log('📅 Creating attendance records...');
    const studentResult = await pool.query('SELECT id FROM students LIMIT 20');
    const students = studentResult.rows;
    const courseCodes = Object.keys(courseIds);
    const adminId = userIds['admin@school.com'];

    for (let i = 0; i < 100; i++) {
      const student = getRandomElement(students);
      const courseCode = getRandomElement(courseCodes);
      const courseId = courseIds[courseCode];
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));
      const statuses = ['present', 'present', 'present', 'absent'];
      const status = getRandomElement(statuses);

      await pool.query(
        `INSERT INTO attendance (id, student_id, course_id, date, status, marked_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [uuidv4(), student.id, courseId, date.toISOString().split('T')[0], status, adminId]
      ).catch(err => {
        // Ignore duplicate attendance errors
        if (!err.message.includes('duplicate') && !err.message.includes('already exists')) {
          console.error(`Error creating attendance: ${err.message}`);
        }
      });
    }
    console.log(`   ✓ Created 100 attendance records`);

    // Create fee structures
    console.log('💰 Creating fee structures...');
    const feeTypes = ['tuition', 'library', 'laboratory', 'sports', 'transport'];
    for (let i = 0; i < 5; i++) {
      const feeType = feeTypes[i];
      const amount = [5000, 1000, 2000, 1500, 3000][i];
      await pool.query(
        `INSERT INTO fee_structures (id, name, description, amount, fee_type, academic_year, due_date, applicable_to, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'all', 'active')
         ON CONFLICT DO NOTHING`,
        [
          uuidv4(), `${feeType.charAt(0).toUpperCase() + feeType.slice(1)} Fee`,
          `Annual ${feeType} fee`, amount, feeType, '2024-2025',
          new Date(2025, 5, 30).toISOString().split('T')[0]
        ]
      ).catch(err => {
        if (!err.message.includes('duplicate') && !err.message.includes('already exists')) {
          console.error(`Error creating fee structure: ${err.message}`);
        }
      });
    }
    console.log(`   ✓ Created 5 fee structures`);

    // Create some payments
    console.log('💳 Creating payment records...');
    const feeResult = await pool.query('SELECT id FROM fee_structures LIMIT 3');
    const fees = feeResult.rows;
    const paymentMethods = ['cash', 'card', 'online', 'bank_transfer'];

    for (let i = 0; i < 30; i++) {
      const student = getRandomElement(students);
      const fee = getRandomElement(fees);
      const method = getRandomElement(paymentMethods);
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 90));
      const statuses = ['completed', 'completed', 'completed', 'pending'];
      const status = getRandomElement(statuses);

      const feeAmountResult = await pool.query('SELECT amount FROM fee_structures WHERE id = $1', [fee.id]);
      const feeAmount = feeAmountResult.rows[0]?.amount || 1000;
      
      await pool.query(
        `INSERT INTO payments (id, student_id, fee_structure_id, amount, payment_method, paid_at, status, transaction_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          uuidv4(), student.id, fee.id, feeAmount, method, date.toISOString(),
          status, `TXN${Date.now()}${i}`
        ]
      ).catch(err => {
        if (!err.message.includes('duplicate') && !err.message.includes('already exists')) {
          console.error(`Error creating payment: ${err.message}`);
        }
      });
    }
    console.log(`   ✓ Created 30 payment records`);

    // Create announcements
    console.log('📢 Creating announcements...');
    const announcements = [
      { title: 'Annual Day Celebration', content: 'Join us for the annual day celebration on December 15th. All students and parents are welcome.', targetAudience: 'all', priority: 'high' },
      { title: 'Parent-Teacher Meeting', content: 'Parent-teacher meeting scheduled for next week. Please check the schedule.', targetAudience: 'parents', priority: 'medium' },
      { title: 'Holiday Notice', content: 'School will be closed for Deepavali holidays from November 10-12.', targetAudience: 'all', priority: 'medium' },
      { title: 'Sports Day Registration', content: 'Registration for annual sports day is now open. Contact your class teacher.', targetAudience: 'students', priority: 'low' },
    ];

    for (const announcement of announcements) {
      await pool.query(
        `INSERT INTO announcements (id, title, content, target_audience, priority, author_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [uuidv4(), announcement.title, announcement.content, announcement.targetAudience, announcement.priority, adminId]
      ).catch(err => {
        if (!err.message.includes('duplicate') && !err.message.includes('already exists')) {
          console.error(`Error creating announcement: ${err.message}`);
        }
      });
    }
    console.log(`   ✓ Created ${announcements.length} announcements`);

    // Create events
    console.log('📅 Creating events...');
    const events = [
      { title: 'Annual Day', description: 'Annual day celebration with cultural programs', startDate: '2024-12-15', endDate: '2024-12-15', location: 'School Auditorium' },
      { title: 'Science Exhibition', description: 'Annual science exhibition showcasing student projects', startDate: '2024-11-20', endDate: '2024-11-22', location: 'School Grounds' },
      { title: 'Sports Day', description: 'Annual sports day with various competitions', startDate: '2025-01-10', endDate: '2025-01-12', location: 'School Playground' },
    ];

    for (const event of events) {
      await pool.query(
        `INSERT INTO events (id, title, description, start_date, end_date, location, target_audience, organizer_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'all', $7)
         ON CONFLICT DO NOTHING`,
        [uuidv4(), event.title, event.description, `${event.startDate}T09:00:00`, `${event.endDate}T17:00:00`, event.location, adminId]
      ).catch(err => {
        if (!err.message.includes('duplicate') && !err.message.includes('already exists')) {
          console.error(`Error creating event: ${err.message}`);
        }
      });
    }
    console.log(`   ✓ Created ${events.length} events`);

    // Create teacher leaves
    console.log('📝 Creating teacher leave applications...');
    const teacherResult = await pool.query('SELECT id, email FROM teachers LIMIT 5');
    const teachers = teacherResult.rows;
    const leaveTypes = ['sick', 'casual', 'personal', 'emergency'];
    const leaveStatuses = ['pending', 'approved', 'rejected', 'approved', 'pending'];
    const leaveReasons = [
      'Medical appointment',
      'Family emergency',
      'Personal work',
      'Health issue',
      'Family function',
      'Medical leave',
      'Casual leave',
      'Personal leave',
      'Emergency situation',
      'Family event'
    ];

    for (let i = 0; i < 15; i++) {
      const teacher = getRandomElement(teachers);
      const leaveType = getRandomElement(leaveTypes);
      const status = getRandomElement(leaveStatuses);
      const reason = getRandomElement(leaveReasons);
      
      // Generate random dates within the last 3 months and next month
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 90) + Math.floor(Math.random() * 30));
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 1);
      
      const appliedAt = new Date(startDate);
      appliedAt.setDate(appliedAt.getDate() - Math.floor(Math.random() * 7));
      
      let reviewedBy = null;
      let reviewedAt = null;
      let reviewNotes = null;
      
      if (status !== 'pending') {
        reviewedBy = adminId;
        reviewedAt = new Date(appliedAt);
        reviewedAt.setDate(reviewedAt.getDate() + Math.floor(Math.random() * 3) + 1);
        if (status === 'rejected') {
          reviewNotes = 'Leave request rejected due to insufficient coverage';
        } else {
          reviewNotes = 'Leave approved';
        }
      }

      await pool.query(
        `INSERT INTO teacher_leaves (id, teacher_id, leave_type, start_date, end_date, reason, status, applied_at, reviewed_by, reviewed_at, review_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT DO NOTHING`,
        [
          uuidv4(), teacher.id, leaveType,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0],
          reason, status, appliedAt.toISOString(),
          reviewedBy, reviewedAt ? reviewedAt.toISOString() : null, reviewNotes
        ]
      ).catch(err => {
        if (!err.message.includes('duplicate') && !err.message.includes('already exists')) {
          console.error(`Error creating leave: ${err.message}`);
        }
      });
    }
    console.log(`   ✓ Created 15 teacher leave applications`);

    // Create grades for students
    console.log('📊 Creating student grades...');
    const studentsResult = await pool.query('SELECT id, class_id FROM students LIMIT 30');
    const studentsForGrades = studentsResult.rows;
    const examTypes = ['unit_test', 'mid_term', 'final', 'assignment', 'project'];
    const examNames = ['First Unit Test', 'Second Unit Test', 'Mid Term Exam', 'Final Exam', 'Assignment 1', 'Assignment 2', 'Project Work'];
    const gradeLetters = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];
    const academicYear = '2024-2025';

    let gradesCreated = 0;
    for (const student of studentsForGrades) {
      // Get courses for this student's class
      const classCoursesResult = await pool.query(
        `SELECT c.id, c.name, c.course_code
         FROM class_courses cc
         JOIN courses c ON cc.course_id = c.id
         WHERE cc.class_id = $1 AND c.academic_year = $2
         LIMIT 5`,
        [student.class_id, academicYear]
      );
      const classCourses = classCoursesResult.rows;

      // Create 2-4 grades per course for each student
      for (const course of classCourses) {
        const numGrades = Math.floor(Math.random() * 3) + 2; // 2-4 grades per course
        const selectedExamTypes = getRandomElement(examTypes);
        
        for (let i = 0; i < numGrades; i++) {
          const examType = getRandomElement(examTypes);
          const examName = examType === 'final' ? 'Final Exam' : 
                          examType === 'mid_term' ? 'Mid Term Exam' :
                          examType === 'unit_test' ? getRandomElement(['First Unit Test', 'Second Unit Test']) :
                          examType === 'assignment' ? getRandomElement(['Assignment 1', 'Assignment 2']) :
                          'Project Work';
          
          const grade = getRandomElement(gradeLetters);
          const maxMarks = examType === 'final' ? 100 : examType === 'mid_term' ? 80 : 50;
          const marksObtained = Math.floor((grade === 'A+' ? 0.95 : grade === 'A' ? 0.85 : grade === 'B+' ? 0.75 : grade === 'B' ? 0.65 : grade === 'C+' ? 0.55 : grade === 'C' ? 0.45 : grade === 'D' ? 0.35 : 0.25) * maxMarks);
          
          const remarks = grade === 'A+' || grade === 'A' ? 'Excellent performance' :
                         grade === 'B+' || grade === 'B' ? 'Good work' :
                         grade === 'C+' || grade === 'C' ? 'Satisfactory' :
                         grade === 'D' ? 'Needs improvement' : 'Failed';

          await pool.query(
            `INSERT INTO grades (id, student_id, course_id, class_id, academic_year, grade, marks_obtained, max_marks, exam_type, exam_name, remarks, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT DO NOTHING`,
            [
              uuidv4(), student.id, course.id, student.class_id, academicYear,
              grade, marksObtained, maxMarks, examType, examName, remarks, adminId
            ]
          ).catch(err => {
            if (!err.message.includes('duplicate') && !err.message.includes('already exists')) {
              console.error(`Error creating grade: ${err.message}`);
            }
          });
          gradesCreated++;
        }
      }
    }
    console.log(`   ✓ Created ${gradesCreated} grade records`);

    // Create academic records for students
    console.log('📚 Creating academic records...');
    const studentsForRecords = await pool.query('SELECT id, class_id FROM students LIMIT 30');
    let recordsCreated = 0;

    for (const student of studentsForRecords.rows) {
      // Get courses for this student's class
      const classCoursesResult = await pool.query(
        `SELECT c.id, c.name, c.course_code, c.credits
         FROM class_courses cc
         JOIN courses c ON cc.course_id = c.id
         WHERE cc.class_id = $1 AND c.academic_year = $2
         LIMIT 5`,
        [student.class_id, academicYear]
      );
      const classCourses = classCoursesResult.rows;

      // Create academic record for each course
      for (const course of classCourses) {
        const grade = getRandomElement(gradeLetters);
        
        await pool.query(
          `INSERT INTO academic_records (id, student_id, course_id, grade, academic_year, credits)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [
            uuidv4(), student.id, course.id, grade, academicYear, course.credits
          ]
        ).catch(err => {
          if (!err.message.includes('duplicate') && !err.message.includes('already exists')) {
            console.error(`Error creating academic record: ${err.message}`);
          }
        });
        recordsCreated++;
      }
    }
    console.log(`   ✓ Created ${recordsCreated} academic records`);

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    users.forEach(user => {
      console.log(`   ${user.role.toUpperCase()}: ${user.email} / password123`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();

