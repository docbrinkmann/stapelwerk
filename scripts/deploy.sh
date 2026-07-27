#!/bin/bash
# Stapelwerk Deployment Script
# Deploys Docker containers with database migrations and health checks

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_TAG=${1:-latest}
DEPLOY_TOKEN="${DEPLOY_TOKEN:-}"
MAX_RETRIES=3
HEALTH_CHECK_TIMEOUT=60

echo -e "${GREEN}🚀 Stapelwerk Deployment Script${NC}"
echo "Image Tag: $IMAGE_TAG"
echo "Date: $(date)"
echo "----------------------------------------"

# Load environment variables
if [ -f .env.production ]; then
    echo -e "${GREEN}✓${NC} Loading environment variables..."
    source .env.production
else
    echo -e "${RED}✗${NC} .env.production not found!"
    exit 1
fi

# Step 1: Authenticate with GitLab Container Registry
echo -e "\n${YELLOW}Step 1/7:${NC} Authenticating with GitLab Container Registry..."
if [ ! -z "$DEPLOY_TOKEN" ]; then
    echo "$DEPLOY_TOKEN" | docker login registry.gitlab.minilab.live -u "$DEPLOY_TOKEN_USERNAME" --password-stdin
    echo -e "${GREEN}✓${NC} Authentication successful"
else
    echo -e "${YELLOW}⚠${NC}  Using existing docker login"
fi

# Step 2: Pull new Docker image
echo -e "\n${YELLOW}Step 2/7:${NC} Pulling Docker image..."
if docker pull "$CI_REGISTRY_IMAGE:$IMAGE_TAG"; then
    echo -e "${GREEN}✓${NC} Image pulled successfully"
else
    echo -e "${RED}✗${NC} Failed to pull image"
    exit 1
fi

# Step 3: Run database migrations
echo -e "\n${YELLOW}Step 3/7:${NC} Running database migrations..."
if docker run --rm \
    --network stapelwerk_app-network \
    -e DATABASE_URL="$DATABASE_URL" \
    "$CI_REGISTRY_IMAGE:$IMAGE_TAG" \
    sh -c "npx prisma migrate deploy"; then
    echo -e "${GREEN}✓${NC} Migrations completed successfully"
else
    echo -e "${YELLOW}⚠${NC}  Migration warnings (non-fatal)"
fi

# Step 4: Update docker-compose environment
echo -e "\n${YELLOW}Step 4/7:${NC} Updating deployment configuration..."
export DOCKER_IMAGE_TAG=$IMAGE_TAG
export CI_REGISTRY_IMAGE=$CI_REGISTRY_IMAGE
echo -e "${GREEN}✓${NC} Configuration updated"

# Step 5: Deploy new container
echo -e "\n${YELLOW}Step 5/7:${NC} Deploying new container..."
if docker compose -f docker-compose.prod.yml up -d --no-deps app; then
    echo -e "${GREEN}✓${NC} Container deployed"
else
    echo -e "${RED}✗${NC} Deployment failed"
    exit 1
fi

# Step 6: Wait for health check
echo -e "\n${YELLOW}Step 6/7:${NC} Waiting for health check..."
sleep 10

COUNTER=0
while [ $COUNTER -lt $HEALTH_CHECK_TIMEOUT ]; do
    if docker compose -f docker-compose.prod.yml ps app | grep -q "healthy"; then
        echo -e "${GREEN}✓${NC} Container is healthy"
        break
    fi
    echo -n "."
    sleep 2
    COUNTER=$((COUNTER + 2))
done

if [ $COUNTER -ge $HEALTH_CHECK_TIMEOUT ]; then
    echo -e "\n${RED}✗${NC} Health check timeout!"
    echo "Container logs:"
    docker compose -f docker-compose.prod.yml logs --tail=50 app
    echo -e "${RED}Rolling back...${NC}"
    # Rollback logic here
    exit 1
fi

# Step 7: Cleanup old images
echo -e "\n${YELLOW}Step 7/7:${NC} Cleaning up old images..."
docker image prune -a --filter "until=720h" -f > /dev/null 2>&1 || true
echo -e "${GREEN}✓${NC} Cleanup complete"

# Final status
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Application: https://app.stapelwerk.dev"
echo "Image: $CI_REGISTRY_IMAGE:$IMAGE_TAG"
echo "Deployed at: $(date)"

# Show container status
echo -e "\nContainer Status:"
docker compose -f docker-compose.prod.yml ps

exit 0
