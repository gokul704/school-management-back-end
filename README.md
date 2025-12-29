# School Management System - Backend API

A comprehensive Node.js/Express backend API for the School Management System with PostgreSQL database.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Student Management**: Complete CRUD operations for student profiles
- **Teacher Management**: Teacher profiles and schedule management
- **Course Management**: Course creation and assignment to teachers
- **Attendance Management**: Digital attendance marking and reporting
- **Admissions**: Application management and document handling
- **Financial Management**: Fee structures and payment tracking
- **Academics**: Assignments, exams, gradebook, and timetable management
- **Communications**: Messaging, announcements, and event management

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **File Upload**: Multer
- **Validation**: express-validator

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

## Installation

1. Clone the repository:
```bash
cd school-management-back-end
```

2. Install dependencies:
```bash
npm install
```

3. Set up PostgreSQL database:
```bash
# Create database
createdb school_management

# Or using psql
psql -U postgres
CREATE DATABASE school_management;
```

4. Run the database schema:
```bash
psql -U postgres -d school_management -f src/database/schema.sql
```

5. Create a `.env` file in the root directory:
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=school_management
DB_USER=postgres
DB_PASSWORD=postgres

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

6. Create uploads directory:
```bash
mkdir uploads
```

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/logout` - Logout user (protected)

### Students
- `GET /api/students` - Get all students (paginated, searchable)
- `GET /api/students/:id` - Get student by ID
- `POST /api/students` - Create new student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student
- `GET /api/students/:id/academic-records` - Get student academic records

### Teachers
- `GET /api/teachers` - Get all teachers (paginated, searchable)
- `GET /api/teachers/:id` - Get teacher by ID
- `POST /api/teachers` - Create new teacher
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher
- `GET /api/teachers/:id/schedule` - Get teacher schedule

### Courses
- `GET /api/courses` - Get all courses (paginated, searchable)
- `GET /api/courses/:id` - Get course by ID
- `POST /api/courses` - Create new course
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

### Attendance
- `POST /api/attendance` - Mark attendance
- `GET /api/attendance` - Get attendance by date
- `GET /api/attendance/student/:id` - Get student attendance
- `GET /api/attendance/report/:id` - Get attendance report
- `PUT /api/attendance/:id` - Update attendance record

### Admissions
- `GET /api/admissions` - Get all applications (filterable by status)
- `GET /api/admissions/:id` - Get application by ID
- `POST /api/admissions` - Create new application
- `PATCH /api/admissions/:id/status` - Update application status
- `POST /api/admissions/:id/documents` - Upload document

### Financial
- `GET /api/financial/fees` - Get fee structures
- `POST /api/financial/fees` - Create fee structure
- `PUT /api/financial/fees/:id` - Update fee structure
- `DELETE /api/financial/fees/:id` - Delete fee structure
- `GET /api/financial/payments` - Get payments (filterable)
- `POST /api/financial/payments` - Record payment
- `GET /api/financial/payments/:id` - Get payment by ID
- `GET /api/financial/reports` - Get financial report

### Academics
- `GET /api/academics/gradebook` - Get gradebook
- `GET /api/academics/assignments` - Get assignments
- `POST /api/academics/assignments` - Create assignment
- `PUT /api/academics/assignments/:id` - Update assignment
- `POST /api/academics/assignments/:id/submit` - Submit assignment
- `POST /api/academics/assignments/submissions/:id/grade` - Grade assignment
- `GET /api/academics/exams` - Get exams
- `POST /api/academics/exams` - Create exam
- `PUT /api/academics/exams/:id` - Update exam
- `POST /api/academics/exams/:id/results` - Publish exam results
- `GET /api/academics/timetable` - Get timetable
- `POST /api/academics/timetable` - Create timetable
- `PUT /api/academics/timetable/:id` - Update timetable

### Communications
- `GET /api/communications/messages` - Get messages
- `POST /api/communications/messages` - Send message
- `PATCH /api/communications/messages/:id/read` - Mark message as read
- `GET /api/communications/announcements` - Get announcements
- `POST /api/communications/announcements` - Create announcement
- `GET /api/communications/events` - Get events
- `POST /api/communications/events` - Create event
- `PUT /api/communications/events/:id` - Update event
- `DELETE /api/communications/events/:id` - Delete event

## Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Success message"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message"
}
```

## Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Database Schema

The database schema includes tables for:
- Users (authentication)
- Students
- Teachers
- Courses
- Classes
- Attendance
- Admission Applications & Documents
- Fee Structures & Payments
- Assignments & Submissions
- Exams & Results
- Timetables & Slots
- Messages
- Announcements
- Events
- Notifications
- Academic Records
- Teacher Schedules

See `src/database/schema.sql` for the complete schema.

## Project Structure

```
src/
├── config/
│   └── database.js          # PostgreSQL connection
├── controllers/             # Route controllers
│   ├── authController.js
│   ├── studentsController.js
│   ├── teachersController.js
│   ├── coursesController.js
│   ├── attendanceController.js
│   ├── admissionsController.js
│   ├── financialController.js
│   ├── academicsController.js
│   └── communicationsController.js
├── middleware/
│   ├── auth.js              # JWT authentication
│   ├── validate.js          # Request validation
│   └── upload.js            # File upload handling
├── routes/                  # API routes
│   ├── auth.js
│   ├── students.js
│   ├── teachers.js
│   ├── courses.js
│   ├── attendance.js
│   ├── admissions.js
│   ├── financial.js
│   ├── academics.js
│   └── communications.js
├── utils/
│   ├── jwt.js               # JWT utilities
│   └── response.js           # Response helpers
├── database/
│   └── schema.sql           # Database schema
└── server.js                # Express app entry point
```

## Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - JWT refresh token secret
- `JWT_EXPIRES_IN` - Access token expiration
- `JWT_REFRESH_EXPIRES_IN` - Refresh token expiration
- `UPLOAD_DIR` - File upload directory
- `MAX_FILE_SIZE` - Maximum file size in bytes

## Testing

Health check endpoint:
```bash
curl http://localhost:3001/api/health
```

## License

MIT
