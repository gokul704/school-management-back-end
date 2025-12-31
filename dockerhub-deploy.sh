#!/bin/bash

# Docker Hub Deployment Script for Backend
# Usage: ./dockerhub-deploy.sh [version] [dockerhub-username]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get version (default: latest)
VERSION=${1:-latest}

# Get Docker Hub username
if [ -z "$2" ]; then
    if [ -z "$DOCKERHUB_USERNAME" ]; then
        echo -e "${YELLOW}Docker Hub username not provided.${NC}"
        echo "Usage: $0 [version] [dockerhub-username]"
        echo "Or set DOCKERHUB_USERNAME environment variable"
        read -p "Enter your Docker Hub username: " DOCKERHUB_USERNAME
    fi
else
    DOCKERHUB_USERNAME=$2
fi

# Image name
IMAGE_NAME="school-management-backend"
FULL_IMAGE_NAME="${DOCKERHUB_USERNAME}/${IMAGE_NAME}:${VERSION}"
LATEST_IMAGE_NAME="${DOCKERHUB_USERNAME}/${IMAGE_NAME}:latest"

echo -e "${GREEN}Building Docker image for backend...${NC}"
echo -e "Image: ${FULL_IMAGE_NAME}"

# Navigate to backend directory
cd "$(dirname "$0")" || exit

# Build the image
echo -e "${GREEN}Step 1: Building image...${NC}"
docker build -t "${FULL_IMAGE_NAME}" -t "${LATEST_IMAGE_NAME}" -f Dockerfile .

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}Build successful!${NC}"

# Check if user is logged in to Docker Hub
echo -e "${GREEN}Step 2: Checking Docker Hub login...${NC}"
if ! docker info | grep -q "Username"; then
    echo -e "${YELLOW}Not logged in to Docker Hub. Please login:${NC}"
    docker login
fi

# Push the image
echo -e "${GREEN}Step 3: Pushing image to Docker Hub...${NC}"
echo -e "Pushing ${FULL_IMAGE_NAME}..."
docker push "${FULL_IMAGE_NAME}"

if [ "$VERSION" != "latest" ]; then
    echo -e "Pushing ${LATEST_IMAGE_NAME}..."
    docker push "${LATEST_IMAGE_NAME}"
fi

echo -e "${GREEN}✅ Successfully pushed to Docker Hub!${NC}"
echo -e "${GREEN}Image URL: https://hub.docker.com/r/${DOCKERHUB_USERNAME}/${IMAGE_NAME}${NC}"
echo ""
echo -e "${YELLOW}To pull and run:${NC}"
echo -e "  docker pull ${FULL_IMAGE_NAME}"
echo -e "  docker run -p 3001:3001 -e DB_HOST=host.docker.internal -e DB_PORT=5432 -e DB_NAME=school_management -e DB_USER=postgres -e DB_PASSWORD=yourpassword -e JWT_SECRET=your-secret -e JWT_REFRESH_SECRET=your-refresh-secret ${FULL_IMAGE_NAME}"

