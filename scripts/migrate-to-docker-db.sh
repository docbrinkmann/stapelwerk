#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Database Migration: Local PostgreSQL → Docker Stack   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
LOCAL_DB_URL="postgresql://sebastian@localhost:5432/build_my_stack_dev"
DOCKER_DB_URL="postgresql://postgres:postgres_dev_password@localhost:5432/build_my_stack_dev"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/build_my_stack_dev_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo -e "${YELLOW}Step 1/5: Exporting data from local PostgreSQL...${NC}"
# Export the local database
pg_dump "${LOCAL_DB_URL}" > "${BACKUP_FILE}"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database exported successfully to: ${BACKUP_FILE}${NC}"
else
    echo -e "${RED}✗ Failed to export database${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2/5: Starting Docker PostgreSQL container...${NC}"
# Stop any running containers and start fresh
docker-compose down postgres 2>/dev/null || true
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo -e "${BLUE}Waiting for PostgreSQL to be ready...${NC}"
max_attempts=30
attempt=0
until docker-compose exec -T postgres pg_isready -U postgres -d build_my_stack_dev > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}✗ PostgreSQL failed to start after ${max_attempts} attempts${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""
echo -e "${GREEN}✓ Docker PostgreSQL is ready${NC}"

echo ""
echo -e "${YELLOW}Step 3/5: Importing data into Docker PostgreSQL...${NC}"
# Import the database dump into Docker PostgreSQL
cat "${BACKUP_FILE}" | docker-compose exec -T postgres psql -U postgres -d build_my_stack_dev
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database imported successfully${NC}"
else
    echo -e "${RED}✗ Failed to import database${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 4/5: Verifying migration...${NC}"
# Count records in Docker database
SERVICE_COUNT=$(docker-compose exec -T postgres psql -U postgres -d build_my_stack_dev -t -c "SELECT COUNT(*) FROM service;" | xargs)
CATEGORY_COUNT=$(docker-compose exec -T postgres psql -U postgres -d build_my_stack_dev -t -c "SELECT COUNT(*) FROM categories;" | xargs)

echo -e "${BLUE}Docker Database Statistics:${NC}"
echo -e "  - Services: ${GREEN}${SERVICE_COUNT}${NC}"
echo -e "  - Categories: ${GREEN}${CATEGORY_COUNT}${NC}"

echo ""
echo -e "${YELLOW}Step 5/5: Updating environment configuration...${NC}"
# Backup current .env files
cp .env .env.backup.${TIMESTAMP}
cp .env.local .env.local.backup.${TIMESTAMP}

# Update .env.local to use Docker database
sed -i '' 's|DATABASE_URL="postgresql://sebastian@localhost:5432/build_my_stack_dev?schema=public"|DATABASE_URL="postgresql://postgres:postgres_dev_password@localhost:5432/build_my_stack_dev"|' .env.local

echo -e "${GREEN}✓ Environment files updated (backups created)${NC}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Migration Completed Successfully!          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Stop your local Next.js dev server (if running)"
echo -e "  2. Regenerate Prisma Client: ${YELLOW}npm run db:generate${NC}"
echo -e "  3. Start dev server: ${YELLOW}npm run dev${NC}"
echo -e ""
echo -e "${BLUE}Docker Commands:${NC}"
echo -e "  - View logs: ${YELLOW}docker-compose logs -f postgres${NC}"
echo -e "  - Stop stack: ${YELLOW}docker-compose down${NC}"
echo -e "  - Start stack: ${YELLOW}docker-compose up -d${NC}"
echo -e ""
echo -e "${YELLOW}⚠️  Note: Your local PostgreSQL database is unchanged.${NC}"
echo -e "${YELLOW}    Backup location: ${BACKUP_FILE}${NC}"
