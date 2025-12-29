# Troubleshooting Guide

## Common Issues and Solutions

### 401 Unauthorized Error

**Possible Causes:**
1. Backend server is not running
2. JWT_SECRET is not set in `.env` file
3. Token has expired
4. Invalid credentials

**Solutions:**
1. **Start the backend server:**
   ```bash
   cd school-management-back-end
   npm run dev
   ```

2. **Check `.env` file has JWT_SECRET:**
   ```env
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
   JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production-min-32-chars
   ```

3. **Verify backend is running:**
   ```bash
   curl http://localhost:3001/api/health
   ```

4. **Test login:**
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@school.com","password":"password123"}'
   ```

### CORS Error

**Possible Causes:**
1. Frontend URL not allowed in CORS configuration
2. Backend CORS not properly configured

**Solutions:**
1. **Check `.env` file has FRONTEND_URL:**
   ```env
   FRONTEND_URL=http://localhost:3000
   ```

2. **In development, CORS allows all origins automatically**

3. **Restart backend server after changing .env:**
   ```bash
   # Stop the server (Ctrl+C) and restart
   npm run dev
   ```

### Database Connection Error

**Possible Causes:**
1. PostgreSQL is not running
2. Database credentials are incorrect
3. Database doesn't exist

**Solutions:**
1. **Start PostgreSQL:**
   ```bash
   # macOS
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   ```

2. **Check database exists:**
   ```bash
   psql -U postgres -l | grep school_management
   ```

3. **Create database if needed:**
   ```bash
   createdb school_management
   ```

4. **Initialize database:**
   ```bash
   npm run init-db
   npm run seed
   ```

### Login Credentials

**Default credentials (after seeding):**
- Admin: `admin@school.com` / `password123`
- Teacher: `teacher1@school.com` / `password123`
- Staff: `staff@school.com` / `password123`

### Frontend Not Connecting to Backend

**Check:**
1. Backend is running on port 3001
2. Frontend `.env.local` has correct API URL:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001/api
   ```
3. Restart frontend after changing `.env.local`:
   ```bash
   # Stop the server (Ctrl+C) and restart
   npm run dev
   ```

### Port Already in Use

**Solution:**
```bash
# Find process using port 3001
lsof -ti:3001

# Kill the process
kill -9 $(lsof -ti:3001)

# Or change PORT in .env file
```

### Token Refresh Issues

If you're getting 401 errors after login:
1. Clear browser localStorage
2. Log in again
3. Check browser console for errors

### Quick Health Check

```bash
# Backend health
curl http://localhost:3001/api/health

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.com","password":"password123"}'
```

If both work, the backend is configured correctly.

