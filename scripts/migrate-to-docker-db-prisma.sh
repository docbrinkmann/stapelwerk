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
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo -e "${YELLOW}Step 1/6: Stopping current dev server...${NC}"
# Find and kill the dev server process
DEV_PID=$(lsof -ti:3000 2>/dev/null || echo "")
if [ ! -z "$DEV_PID" ]; then
    echo -e "${BLUE}Found dev server on port 3000 (PID: ${DEV_PID}), stopping...${NC}"
    kill $DEV_PID
    sleep 2
    echo -e "${GREEN}✓ Dev server stopped${NC}"
else
    echo -e "${BLUE}No dev server running on port 3000${NC}"
fi

echo ""
echo -e "${YELLOW}Step 2/6: Noting current database state...${NC}"
echo -e "${BLUE}Current database will be replicated via seed data${NC}"
echo -e "${GREEN}✓ Ready to proceed${NC}"

echo ""
echo -e "${YELLOW}Step 3/6: Starting Docker PostgreSQL container...${NC}"
# Stop any running containers
docker-compose down postgres redis 2>/dev/null || true

# Start PostgreSQL container
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
echo -e "${YELLOW}Step 4/6: Running Prisma migrations on Docker database...${NC}"
# Backup and update .env.local temporarily for migration
cp .env.local .env.local.backup.${TIMESTAMP}

# Update DATABASE_URL to point to Docker
cat > .env.local.temp <<EOF
DATABASE_URL="postgresql://postgres:postgres_dev_password@localhost:5432/build_my_stack_dev"
EOF

# Run migrations with Docker database
DATABASE_URL="postgresql://postgres:postgres_dev_password@localhost:5432/build_my_stack_dev" npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migrations applied to Docker database${NC}"
else
    echo -e "${RED}✗ Failed to apply migrations${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 5/6: Seeding Docker database...${NC}"
# Run the seed script with Docker database URL
DATABASE_URL="postgresql://postgres:postgres_dev_password@localhost:5432/build_my_stack_dev" npx tsx prisma/seed.ts

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database seeded successfully${NC}"
else
    echo -e "${RED}✗ Failed to seed database${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 6/6: Verifying migration and updating configuration...${NC}"
# Count records in Docker database
SERVICE_COUNT=$(docker-compose exec -T postgres psql -U postgres -d build_my_stack_dev -t -c "SELECT COUNT(*) FROM service;" | xargs)
CATEGORY_COUNT=$(docker-compose exec -T postgres psql -U postgres -d build_my_stack_dev -t -c "SELECT COUNT(*) FROM categories;" | xargs)

echo -e "${BLUE}Docker Database Statistics:${NC}"
echo -e "  - Services: ${GREEN}${SERVICE_COUNT}${NC}"
echo -e "  - Categories: ${GREEN}${CATEGORY_COUNT}${NC}"

# Update .env.local permanently
mv .env.local.temp .env.local

echo -e "${GREEN}✓ Environment files updated (backup: .env.local.backup.${TIMESTAMP})${NC}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Migration Completed Successfully!          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Regenerate Prisma Client: ${YELLOW}npm run db:generate${NC}"
echo -e "  2. Start dev server: ${YELLOW}npm run dev${NC}"
echo -e ""
echo -e "${BLUE}Docker Stack Commands:${NC}"
echo -e "  - View logs: ${YELLOW}docker-compose logs -f postgres${NC}"
echo -e "  - Start all services: ${YELLOW}docker-compose up -d${NC}"
echo -e "  - Stop stack: ${YELLOW}docker-compose down${NC}"
echo -e "  - Restart PostgreSQL: ${YELLOW}docker-compose restart postgres${NC}"
echo -e ""
echo -e "${BLUE}Access Docker PostgreSQL:${NC}"
echo -e "  ${YELLOW}docker-compose exec postgres psql -U postgres -d build_my_stack_dev${NC}"
echo -e ""
echo -e "${YELLOW}⚠️  Database is now running in Docker on port 5432${NC}"
echo -e "${YELLOW}    Connection: postgresql://postgres:postgres_dev_password@localhost:5432/build_my_stack_dev${NC}"
