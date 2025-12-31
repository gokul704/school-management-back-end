#!/bin/bash

# Railway Environment Variables Setup Script for Backend
# Usage: ./setup-railway-env.sh [service-name]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SERVICE_NAME=${1:-school-management-back-end}

echo -e "${BLUE}🚀 Railway Backend Environment Variables Setup${NC}"
echo -e "${BLUE}Service: ${SERVICE_NAME}${NC}"
echo ""

# Check if railway CLI is installed
if ! command -v railway &> /dev/null
then
    echo -e "${RED}❌ Railway CLI not found.${NC}"
    echo "Install it with: npm i -g @railway/cli"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Railway. Please login:${NC}"
    railway login
fi

# Navigate to backend directory
cd "$(dirname "$0")" || exit

# Link to service if not already linked
echo -e "${GREEN}📌 Linking to Railway service...${NC}"
railway link --service "$SERVICE_NAME" 2>/dev/null || echo "Already linked or service not found"

echo ""
echo -e "${YELLOW}📝 Setting up environment variables...${NC}"
echo ""

# Prompt for required variables
read -p "Enter FRONTEND_URL (e.g., https://your-frontend.railway.app): " FRONTEND_URL
read -sp "Enter JWT_SECRET (min 32 chars, press Enter to generate): " JWT_SECRET
echo ""

if [ -z "$JWT_SECRET" ]; then
    if command -v openssl &> /dev/null; then
        JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
        echo -e "${GREEN}✅ Generated JWT_SECRET${NC}"
    else
        echo -e "${RED}❌ openssl not found. Please provide JWT_SECRET manually.${NC}"
        read -sp "Enter JWT_SECRET: " JWT_SECRET
        echo ""
    fi
fi

read -sp "Enter JWT_REFRESH_SECRET (min 32 chars, press Enter to generate): " JWT_REFRESH_SECRET
echo ""

if [ -z "$JWT_REFRESH_SECRET" ]; then
    if command -v openssl &> /dev/null; then
        JWT_REFRESH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
        echo -e "${GREEN}✅ Generated JWT_REFRESH_SECRET${NC}"
    else
        echo -e "${RED}❌ openssl not found. Please provide JWT_REFRESH_SECRET manually.${NC}"
        read -sp "Enter JWT_REFRESH_SECRET: " JWT_REFRESH_SECRET
        echo ""
    fi
fi

# Optional variables with defaults
read -p "Enter JWT_EXPIRES_IN [24h]: " JWT_EXPIRES_IN
JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-24h}

read -p "Enter JWT_REFRESH_EXPIRES_IN [7d]: " JWT_REFRESH_EXPIRES_IN
JWT_REFRESH_EXPIRES_IN=${JWT_REFRESH_EXPIRES_IN:-7d}

read -p "Enter DB_MAX_CONNECTIONS [15]: " DB_MAX_CONNECTIONS
DB_MAX_CONNECTIONS=${DB_MAX_CONNECTIONS:-15}

echo ""
echo -e "${GREEN}🔧 Setting environment variables in Railway...${NC}"
echo ""

# Set required variables
railway variables set NODE_ENV=production --service "$SERVICE_NAME"
railway variables set "FRONTEND_URL=$FRONTEND_URL" --service "$SERVICE_NAME"
railway variables set "JWT_SECRET=$JWT_SECRET" --service "$SERVICE_NAME"
railway variables set "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET" --service "$SERVICE_NAME"

# Set optional variables
railway variables set "JWT_EXPIRES_IN=$JWT_EXPIRES_IN" --service "$SERVICE_NAME"
railway variables set "JWT_REFRESH_EXPIRES_IN=$JWT_REFRESH_EXPIRES_IN" --service "$SERVICE_NAME"
railway variables set "DB_MAX_CONNECTIONS=$DB_MAX_CONNECTIONS" --service "$SERVICE_NAME"
railway variables set UPLOAD_DIR=uploads --service "$SERVICE_NAME"
railway variables set MAX_FILE_SIZE=5242880 --service "$SERVICE_NAME"

echo ""
echo -e "${GREEN}✅ Environment variables set successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "  NODE_ENV=production"
echo -e "  FRONTEND_URL=$FRONTEND_URL"
echo -e "  JWT_SECRET=*** (hidden)"
echo -e "  JWT_REFRESH_SECRET=*** (hidden)"
echo -e "  JWT_EXPIRES_IN=$JWT_EXPIRES_IN"
echo -e "  JWT_REFRESH_EXPIRES_IN=$JWT_REFRESH_EXPIRES_IN"
echo -e "  DB_MAX_CONNECTIONS=$DB_MAX_CONNECTIONS"
echo ""
echo -e "${YELLOW}⚠️  Note: Database variables (PGHOST, PGPORT, etc.) are auto-provided by Railway when you add PostgreSQL.${NC}"
echo ""
echo -e "${GREEN}✅ Setup complete! Your backend will redeploy automatically.${NC}"

