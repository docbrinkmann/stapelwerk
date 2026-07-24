#!/bin/bash
# Stapelwerk Rollback Script
# Reverts to a previous Docker image version

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Image tag required${NC}"
    echo "Usage: ./rollback.sh <image-tag>"
    echo "Example: ./rollback.sh abc123def456"
    exit 1
fi

ROLLBACK_TAG=$1

echo -e "${YELLOW}⏪ Stapelwerk Rollback Script${NC}"
echo "Rolling back to: $ROLLBACK_TAG"
echo "Date: $(date)"
echo "----------------------------------------"

# Load environment
if [ -f .env.production ]; then
    source .env.production
else
    echo -e "${RED}✗${NC} .env.production not found!"
    exit 1
fi

# Step 1: Pull previous image
echo -e "\n${YELLOW}Step 1/4:${NC} Pulling previous image..."
if docker pull "$CI_REGISTRY_IMAGE:$ROLLBACK_TAG"; then
    echo -e "${GREEN}✓${NC} Image pulled"
else
    echo -e "${RED}✗${NC} Failed to pull image $ROLLBACK_TAG"
    exit 1
fi

# Step 2: Stop current container
echo -e "\n${YELLOW}Step 2/4:${NC} Stopping current container..."
docker compose -f docker-compose.prod.yml stop app
echo -e "${GREEN}✓${NC} Container stopped"

# Step 3: Update and deploy
echo -e "\n${YELLOW}Step 3/4:${NC} Deploying previous version..."
export DOCKER_IMAGE_TAG=$ROLLBACK_TAG
docker compose -f docker-compose.prod.yml up -d --no-deps app
echo -e "${GREEN}✓${NC} Rollback deployed"

# Step 4: Verify health
echo -e "\n${YELLOW}Step 4/4:${NC} Verifying health..."
sleep 15

if docker compose -f docker-compose.prod.yml ps app | grep -q "healthy"; then
    echo -e "${GREEN}✓${NC} Rollback successful!"
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ Rolled back to $ROLLBACK_TAG${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "${RED}✗${NC} Health check failed after rollback!"
    docker compose -f docker-compose.prod.yml logs --tail=50 app
    exit 1
fi

docker compose -f docker-compose.prod.yml ps
exit 0
