# Backend Setup Guide

## Quick Start

1. **Install Dependencies**
```bash
npm install
```

2. **Set up PostgreSQL Database**
```bash
# Create database
createdb school_management

# Or using psql
psql -U postgres
CREATE DATABASE school_management;
\q
```

3. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. **Initialize Database Schema**
```bash
# Option 1: Using psql
psql -U postgres -d school_management -f src/database/schema.sql

# Option 2: Using Node.js script (after setting up .env)
npm run init-db
```

5. **Start the Server**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Default Admin Credentials

After running the database initialization:
- Email: `admin@school.com`
- Password: `admin123`

**Important**: Change these credentials in production!

## API Base URL

The API runs on `http://localhost:3001/api` by default.

## Testing the API

```bash
# Health check
curl http://localhost:3001/api/health

# Login (after creating admin user)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.com","password":"admin123"}'
```

## Database Schema

The complete database schema is in `src/database/schema.sql`. It includes:
- Users table for authentication
- Students, Teachers, Courses tables
- Attendance tracking
- Admissions and documents
- Financial management (fees and payments)
- Academic features (assignments, exams, timetables)
- Communications (messages, announcements, events)
- Notifications

## Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running
- Check database credentials in `.env`
- Verify database exists: `psql -U postgres -l`

### Port Already in Use
- Change PORT in `.env` file
- Or kill the process using port 3001

### JWT Errors
- Ensure JWT_SECRET and JWT_REFRESH_SECRET are set in `.env`
- Use strong, random secrets in production

