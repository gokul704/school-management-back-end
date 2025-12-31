#!/bin/bash

# Backend Deployment Script
# Usage: ./deploy.sh [railway|docker|build]

set -e

DEPLOY_TYPE=${1:-railway}
PROJECT_NAME="school-management-back-end"

echo "🚀 Starting deployment for $PROJECT_NAME..."

case $DEPLOY_TYPE in
  railway)
    echo "📦 Deploying to Railway..."
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
      echo "❌ Railway CLI not found. Installing..."
      npm install -g @railway/cli
    fi
    
    # Check if logged in
    if ! railway whoami &> /dev/null; then
      echo "🔐 Please login to Railway..."
      railway login
    fi
    
    # Link to project if not already linked
    if [ ! -f .railway/project.json ]; then
      echo "🔗 Linking to Railway project..."
      railway link
    fi
    
    # Deploy
    echo "🚢 Deploying to Railway..."
    railway up
    
    echo "✅ Deployment complete!"
    echo "📊 Check status: railway status"
    ;;
    
  docker)
    echo "🐳 Building Docker image..."
    docker build -t $PROJECT_NAME:latest .
    
    echo "✅ Docker image built: $PROJECT_NAME:latest"
    echo "📝 Run with: docker run -p 3001:3001 $PROJECT_NAME:latest"
    ;;
    
  build)
    echo "🔨 Building application..."
    npm install
    echo "✅ Build complete!"
    ;;
    
  *)
    echo "❌ Unknown deployment type: $DEPLOY_TYPE"
    echo "Usage: ./deploy.sh [railway|docker|build]"
    exit 1
    ;;
esac

