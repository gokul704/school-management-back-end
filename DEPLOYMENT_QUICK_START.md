# Quick Deployment Guide

## Railway Backend Setup (5 minutes)

1. **Create Railway Project**
   - Go to https://railway.app
   - New Project → Deploy from GitHub
   - Select `school-management-back-end` repo

2. **Add PostgreSQL**
   - Click "+ New" → Database → Add PostgreSQL

3. **Set Environment Variables**
   ```
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=https://your-app.vercel.app
   DB_MAX_CONNECTIONS=15
   JWT_SECRET=<generate-strong-secret>
   JWT_REFRESH_SECRET=<generate-strong-secret>
   JWT_EXPIRES_IN=24h
   JWT_REFRESH_EXPIRES_IN=7d
   ```
   Railway auto-provides: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

4. **Initialize Database**
   ```bash
   railway run node src/database/init.js
   railway run node src/database/run-migration.js
   railway run node src/database/seed.js
   ```

5. **Get Backend URL**
   - Settings → Generate Domain
   - Copy URL: `https://your-backend.railway.app`

## Vercel Frontend Setup (3 minutes)

1. **Import to Vercel**
   - Go to https://vercel.com
   - Add New Project
   - Import `school-management-front-end` repo

2. **Set Environment Variable**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
   ```

3. **Deploy**
   - Click Deploy
   - Get URL: `https://your-app.vercel.app`

4. **Update Backend CORS**
   - Go back to Railway
   - Update `FRONTEND_URL` to your Vercel URL
   - Railway auto-redeploys

## Done! 🎉

Your app is live at: `https://your-app.vercel.app`

