# Database Seed Data

This document describes the seed data that will be populated when you run `npm run seed`.

## Login Credentials

After running the seed script, you can use these credentials to log in:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@school.com | password123 |
| Teacher | teacher1@school.com | password123 |
| Teacher | teacher2@school.com | password123 |
| Teacher | teacher3@school.com | password123 |
| Staff | staff@school.com | password123 |

## Seed Data Includes

### Users
- 1 Admin user (Principal Ramesh Kumar)
- 3 Teacher users
- 1 Staff user

### Classes
- 6 classes (Class 10-A, 10-B, 11-A, 11-B, 12-A, 12-B)
- Academic Year: 2024-2025

### Teachers
- 8 teachers with South Indian names
- Qualifications: M.Sc, M.A, Ph.D in various subjects
- Specializations: Mathematics, English, Physics, Chemistry, Biology, Computer Science, History, Tamil
- Locations: Chennai, Bangalore, Hyderabad, Coimbatore, Madurai, etc.

### Students
- 50 students with South Indian names
- Distributed across all classes
- Complete parent/guardian information
- South Indian addresses (Chennai, Bangalore, Hyderabad, etc.)

### Courses
- 10 courses covering major subjects
- Assigned to teachers
- Academic Year: 2024-2025, Semester: Fall

### Attendance
- 100 attendance records
- Mix of present, absent, late, and excused statuses
- Spread across the last 30 days

### Fee Structures
- 5 fee structures (Tuition, Library, Laboratory, Sports, Transport)
- Academic Year: 2024-2025

### Payments
- 30 payment records
- Various payment methods (cash, card, online, bank_transfer)
- Mix of completed and pending statuses

### Announcements
- 4 announcements covering various school events
- Different target audiences and priority levels

### Events
- 3 events (Annual Day, Science Exhibition, Sports Day)
- Scheduled for upcoming dates

## Running the Seed Script

```bash
# Make sure your database is initialized first
npm run init-db

# Then run the seed script
npm run seed
```

## Notes

- The seed script uses `ON CONFLICT DO NOTHING` to avoid errors if data already exists
- All passwords are set to `password123` for easy testing
- Student and teacher IDs are auto-generated
- All dates are randomized within realistic ranges
- Phone numbers are generated as Indian mobile numbers (+91 format)

