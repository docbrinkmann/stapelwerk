#!/bin/bash
set -e

# Build-My-Stack Docker Setup Script
# This script initializes the Docker development environment

echo "🚀 Build-My-Stack Docker Setup"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"

# Check if .env.docker exists
if [ ! -f ".env.docker" ]; then
    echo -e "${YELLOW}⚠️  .env.docker not found. Creating from template...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env.docker
        echo -e "${GREEN}✓ Created .env.docker from .env.example${NC}"
    else
        echo -e "${RED}❌ No .env.example found. Please create .env.docker manually.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Environment file exists${NC}"

# Create necessary directories
echo ""
echo "📁 Creating necessary directories..."
mkdir -p docker/postgres-init
mkdir -p .next
mkdir -p coverage

# Create postgres init script if it doesn't exist
if [ ! -f "docker/postgres-init/01-init.sql" ]; then
    cat > docker/postgres-init/01-init.sql << 'EOF'
-- Build-My-Stack Database Initialization
-- This script runs when the PostgreSQL container is first created

-- Create test database
CREATE DATABASE build_my_stack_test;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE build_my_stack_dev TO postgres;
GRANT ALL PRIVILEGES ON DATABASE build_my_stack_test TO postgres;

-- Enable required extensions
\c build_my_stack_dev;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\c build_my_stack_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Log completion
SELECT 'Database initialization completed successfully' AS status;
EOF
    echo -e "${GREEN}✓ Created PostgreSQL init script${NC}"
fi

# Stop any running containers
echo ""
echo "🛑 Stopping any running containers..."
docker-compose down 2>/dev/null || true

# Remove old volumes if requested
if [ "$1" = "--clean" ]; then
    echo -e "${YELLOW}⚠️  Removing all volumes (clean install)...${NC}"
    docker-compose down -v
    echo -e "${GREEN}✓ Volumes removed${NC}"
fi

# Build images
echo ""
echo "🔨 Building Docker images..."
docker-compose build --no-cache

# Start services
echo ""
echo "🚀 Starting services..."
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U postgres -d build_my_stack_dev > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ PostgreSQL failed to start after 30 seconds${NC}"
        docker-compose logs postgres
        exit 1
    fi
    echo -n "."
    sleep 1
done

# Wait for Redis to be ready
echo ""
echo "⏳ Waiting for Redis to be ready..."
for i in {1..10}; do
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is ready${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Redis failed to start after 10 seconds${NC}"
        docker-compose logs redis
        exit 1
    fi
    echo -n "."
    sleep 1
done

# Start app service
echo ""
echo "🚀 Starting application..."
docker-compose up -d app

# Wait for app to be ready
echo ""
echo "⏳ Waiting for application to be ready (this may take a minute)..."
for i in {1..60}; do
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Application is ready${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${YELLOW}⚠️  Application health check timed out${NC}"
        echo -e "${YELLOW}This is normal on first startup. Check logs with: docker-compose logs app${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# Display status
echo ""
echo "================================"
echo -e "${GREEN}✅ Docker environment is ready!${NC}"
echo ""
echo "Services running:"
echo "  - Application: http://localhost:3000"
echo "  - PostgreSQL:  localhost:5432"
echo "  - Redis:       localhost:6379"
echo ""
echo "Useful commands:"
echo "  docker-compose logs -f         # View all logs"
echo "  docker-compose logs -f app     # View app logs"
echo "  docker-compose exec app sh     # Shell into app container"
echo "  docker-compose down            # Stop all services"
echo "  docker-compose restart app     # Restart app service"
echo ""
echo "Run migrations:"
echo "  docker-compose exec app npm run prisma:migrate:dev"
echo ""
echo "Run seeds:"
echo "  docker-compose exec app npm run prisma:seed"
echo ""
echo "================================"
