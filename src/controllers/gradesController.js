const pool = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');

// Get grades for a student
const getStudentGrades = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { classId, academicYear } = req.query;

    let query = `
      SELECT g.*, 
             c.name as course_name, c.course_code,
             cls.name as class_name, cls.grade_level,
             u.name as created_by_name
      FROM grades g
      JOIN courses c ON g.course_id = c.id
      JOIN classes cls ON g.class_id = cls.id
      LEFT JOIN users u ON g.created_by = u.id
      WHERE g.student_id = $1
    `;
    const params = [studentId];
    let paramCount = 2;

    if (classId) {
      query += ` AND g.class_id = $${paramCount++}`;
      params.push(classId);
    }

    if (academicYear) {
      query += ` AND g.academic_year = $${paramCount++}`;
      params.push(academicYear);
    }

    query += ` ORDER BY g.academic_year DESC, c.name ASC`;

    const result = await pool.query(query, params);

    const grades = result.rows.map(row => ({
      id: row.id,
      studentId: row.student_id,
      courseId: row.course_id,
      courseName: row.course_name,
      courseCode: row.course_code,
      classId: row.class_id,
      className: row.class_name,
      gradeLevel: row.grade_level,
      academicYear: row.academic_year,
      grade: row.grade,
      marksObtained: row.marks_obtained ? parseFloat(row.marks_obtained) : null,
      maxMarks: row.max_marks ? parseFloat(row.max_marks) : null,
      examType: row.exam_type,
      examName: row.exam_name,
      remarks: row.remarks,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    sendSuccess(res, grades);
  } catch (error) {
    console.error('Get student grades error:', error);
    sendError(res, 'Failed to fetch grades', 500);
  }
};

// Get progress card for a student (all subjects in a class)
const getProgressCard = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { classId, academicYear } = req.query;

    if (!classId || !academicYear) {
      return sendError(res, 'classId and academicYear are required', 400);
    }

    // Get student and class info
    const studentResult = await pool.query(
      `SELECT s.*, c.name as class_name, c.grade_level
       FROM students s
       JOIN classes c ON s.class_id = c.id
       WHERE s.id = $1 AND c.id = $2`,
      [studentId, classId]
    );

    if (studentResult.rows.length === 0) {
      return sendError(res, 'Student or class not found', 404);
    }

    const student = studentResult.rows[0];

    // Get all courses for this class
    const coursesResult = await pool.query(
      `SELECT DISTINCT c.*
       FROM courses c
       JOIN class_courses cc ON cc.course_id = c.id
       WHERE cc.class_id = $1 AND c.academic_year = $2 AND c.status = 'active'
       ORDER BY c.name`,
      [classId, academicYear]
    );

    const courses = coursesResult.rows;

    // Get all grades for this student in this class and academic year
    const gradesResult = await pool.query(
      `SELECT g.*, c.name as course_name, c.course_code
       FROM grades g
       JOIN courses c ON g.course_id = c.id
       WHERE g.student_id = $1 AND g.class_id = $2 AND g.academic_year = $3
       ORDER BY c.name, g.exam_type, g.created_at`,
      [studentId, classId, academicYear]
    );

    const allGrades = gradesResult.rows;

    // Organize grades by course
    const progressCard = courses.map(course => {
      const courseGrades = allGrades.filter(g => g.course_id === course.id);
      
      // Calculate final grade (average of all exam types or latest final exam)
      let finalGrade = null;
      let finalMarks = null;
      let totalMarks = null;
      let averagePercentage = null;

      if (courseGrades.length > 0) {
        // Get final exam grade if exists
        const finalExam = courseGrades.find(g => g.exam_type === 'final');
        if (finalExam) {
          finalGrade = finalExam.grade;
          finalMarks = finalExam.marks_obtained ? parseFloat(finalExam.marks_obtained) : null;
          totalMarks = finalExam.max_marks ? parseFloat(finalExam.max_marks) : null;
        } else {
          // Calculate average from all grades
          const gradesWithMarks = courseGrades.filter(g => g.marks_obtained && g.max_marks);
          if (gradesWithMarks.length > 0) {
            const totalObtained = gradesWithMarks.reduce((sum, g) => sum + parseFloat(g.marks_obtained), 0);
            const totalMax = gradesWithMarks.reduce((sum, g) => sum + parseFloat(g.max_marks), 0);
            averagePercentage = (totalObtained / totalMax) * 100;
            
            // Convert percentage to grade
            if (averagePercentage >= 90) finalGrade = 'A+';
            else if (averagePercentage >= 80) finalGrade = 'A';
            else if (averagePercentage >= 70) finalGrade = 'B+';
            else if (averagePercentage >= 60) finalGrade = 'B';
            else if (averagePercentage >= 50) finalGrade = 'C+';
            else if (averagePercentage >= 40) finalGrade = 'C';
            else if (averagePercentage >= 33) finalGrade = 'D';
            else finalGrade = 'F';
            
            finalMarks = totalObtained;
            totalMarks = totalMax;
          } else {
            // Use the latest grade if no marks available
            finalGrade = courseGrades[courseGrades.length - 1].grade;
          }
        }
      }

      return {
        courseId: course.id,
        courseCode: course.course_code,
        courseName: course.name,
        finalGrade,
        finalMarks,
        totalMarks,
        averagePercentage,
        grades: courseGrades.map(g => ({
          id: g.id,
          examType: g.exam_type,
          examName: g.exam_name,
          grade: g.grade,
          marksObtained: g.marks_obtained ? parseFloat(g.marks_obtained) : null,
          maxMarks: g.max_marks ? parseFloat(g.max_marks) : null,
          remarks: g.remarks,
          createdAt: g.created_at
        }))
      };
    });

    // Calculate overall performance
    const gradesWithFinal = progressCard.filter(p => p.finalGrade);
    let overallGrade = null;
    let overallPercentage = null;

    if (gradesWithFinal.length > 0) {
      if (gradesWithFinal.every(p => p.averagePercentage !== null)) {
        overallPercentage = gradesWithFinal.reduce((sum, p) => sum + (p.averagePercentage || 0), 0) / gradesWithFinal.length;
        
        if (overallPercentage >= 90) overallGrade = 'A+';
        else if (overallPercentage >= 80) overallGrade = 'A';
        else if (overallPercentage >= 70) overallGrade = 'B+';
        else if (overallPercentage >= 60) overallGrade = 'B';
        else if (overallPercentage >= 50) overallGrade = 'C+';
        else if (overallPercentage >= 40) overallGrade = 'C';
        else if (overallPercentage >= 33) overallGrade = 'D';
        else overallGrade = 'F';
      }
    }

    sendSuccess(res, {
      student: {
        id: student.id,
        studentId: student.student_id,
        firstName: student.first_name,
        lastName: student.last_name,
        name: `${student.first_name} ${student.last_name}`
      },
      class: {
        id: classId,
        name: student.class_name,
        gradeLevel: student.grade_level
      },
      academicYear,
      subjects: progressCard,
      overall: {
        grade: overallGrade,
        percentage: overallPercentage,
        totalSubjects: progressCard.length,
        subjectsWithGrades: gradesWithFinal.length
      }
    });
  } catch (error) {
    console.error('Get progress card error:', error);
    sendError(res, 'Failed to fetch progress card', 500);
  }
};

// Create or update a grade
const createOrUpdateGrade = async (req, res) => {
  try {
    const { id } = req.params; // For PUT requests
    const {
      studentId, courseId, classId, academicYear,
      grade, marksObtained, maxMarks, examType = 'final',
      examName, remarks
    } = req.body;

    if (!studentId || !courseId || !classId || !academicYear || !grade) {
      return sendError(res, 'studentId, courseId, classId, academicYear, and grade are required', 400);
    }

    let result;
    
    // If ID is provided (PUT request), update the specific grade
    if (id) {
      const existingResult = await pool.query('SELECT id FROM grades WHERE id = $1', [id]);
      if (existingResult.rows.length === 0) {
        return sendError(res, 'Grade not found', 404);
      }
      
      result = await pool.query(
        `UPDATE grades 
         SET student_id = $1, course_id = $2, class_id = $3, academic_year = $4,
             grade = $5, marks_obtained = $6, max_marks = $7, 
             exam_type = $8, exam_name = $9, remarks = $10, updated_at = NOW()
         WHERE id = $11
         RETURNING *`,
        [studentId, courseId, classId, academicYear, grade, marksObtained, maxMarks, examType, examName, remarks, id]
      );
    } else {
      // Check if grade already exists for this combination
      const existingResult = await pool.query(
        `SELECT id FROM grades 
         WHERE student_id = $1 AND course_id = $2 AND class_id = $3 
         AND academic_year = $4 AND exam_type = $5`,
        [studentId, courseId, classId, academicYear, examType]
      );

      if (existingResult.rows.length > 0) {
        // Update existing grade
        result = await pool.query(
          `UPDATE grades 
           SET grade = $1, marks_obtained = $2, max_marks = $3, 
               exam_name = $4, remarks = $5, updated_at = NOW()
           WHERE id = $6
           RETURNING *`,
          [grade, marksObtained, maxMarks, examName, remarks, existingResult.rows[0].id]
        );
      } else {
        // Create new grade
        result = await pool.query(
          `INSERT INTO grades (
            id, student_id, course_id, class_id, academic_year,
            grade, marks_obtained, max_marks, exam_type, exam_name, remarks, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *`,
          [
            uuidv4(), studentId, courseId, classId, academicYear,
            grade, marksObtained, maxMarks, examType, examName, remarks, req.user.id
          ]
        );
      }
    }

    const row = result.rows[0];
    sendSuccess(res, {
      id: row.id,
      studentId: row.student_id,
      courseId: row.course_id,
      classId: row.class_id,
      academicYear: row.academic_year,
      grade: row.grade,
      marksObtained: row.marks_obtained ? parseFloat(row.marks_obtained) : null,
      maxMarks: row.max_marks ? parseFloat(row.max_marks) : null,
      examType: row.exam_type,
      examName: row.exam_name,
      remarks: row.remarks,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }, id ? 'Grade updated successfully' : (result.rows[0].id ? 'Grade created successfully' : 'Grade updated successfully'), id ? 200 : 201);
  } catch (error) {
    console.error('Create/update grade error:', error);
    sendError(res, 'Failed to save grade', 500);
  }
};

// Delete a grade
const deleteGrade = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM grades WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return sendError(res, 'Grade not found', 404);
    }

    sendSuccess(res, null, 'Grade deleted successfully');
  } catch (error) {
    console.error('Delete grade error:', error);
    sendError(res, 'Failed to delete grade', 500);
  }
};

// Get grades for a class (all students)
const getClassGrades = async (req, res) => {
  try {
    const { classId } = req.params;
    const { academicYear, courseId } = req.query;

    if (!academicYear) {
      return sendError(res, 'academicYear is required', 400);
    }

    let query = `
      SELECT g.*, 
             s.student_id, s.first_name, s.last_name,
             c.name as course_name, c.course_code,
             cls.name as class_name
      FROM grades g
      JOIN students s ON g.student_id = s.id
      JOIN courses c ON g.course_id = c.id
      JOIN classes cls ON g.class_id = cls.id
      WHERE g.class_id = $1 AND g.academic_year = $2
    `;
    const params = [classId, academicYear];
    let paramCount = 3;

    if (courseId) {
      query += ` AND g.course_id = $${paramCount++}`;
      params.push(courseId);
    }

    query += ` ORDER BY s.first_name, s.last_name, c.name`;

    const result = await pool.query(query, params);

    const grades = result.rows.map(row => ({
      id: row.id,
      studentId: row.student_id,
      studentName: `${row.first_name} ${row.last_name}`,
      courseId: row.course_id,
      courseName: row.course_name,
      courseCode: row.course_code,
      classId: row.class_id,
      className: row.class_name,
      academicYear: row.academic_year,
      grade: row.grade,
      marksObtained: row.marks_obtained ? parseFloat(row.marks_obtained) : null,
      maxMarks: row.max_marks ? parseFloat(row.max_marks) : null,
      examType: row.exam_type,
      examName: row.exam_name,
      remarks: row.remarks,
      createdAt: row.created_at
    }));

    sendSuccess(res, grades);
  } catch (error) {
    console.error('Get class grades error:', error);
    sendError(res, 'Failed to fetch class grades', 500);
  }
};

module.exports = {
  getStudentGrades,
  getProgressCard,
  createOrUpdateGrade,
  deleteGrade,
  getClassGrades
};

