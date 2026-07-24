#!/bin/bash

# Production Database Initialization and Seeding Script
# Initializes database with production-ready data, use case templates, and configurations

set -e

# Script Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
INIT_LOG="${PROJECT_ROOT}/logs/db-init-$(date +%Y%m%d-%H%M%S).log"
SEED_DATA_DIR="${PROJECT_ROOT}/prisma/seed-data"

# Database Configuration
DB_URL="${DATABASE_URL:-}"
DB_PROVIDER="${DB_PROVIDER:-postgresql}"
NODE_ENV="${NODE_ENV:-production}"

# Initialization Settings
FORCE_INIT=false
SKIP_MIGRATION=false
SKIP_SEED=false
SEED_LEVEL="production"  # minimal, development, production
DRY_RUN=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${INIT_LOG}"
    
    case $level in
        "ERROR")
            echo -e "${RED}${timestamp} [${level}] ${message}${NC}" >&2
            ;;
        "WARN")
            echo -e "${YELLOW}${timestamp} [${level}] ${message}${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}${timestamp} [${level}] ${message}${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}${timestamp} [${level}] ${message}${NC}"
            ;;
        "DEBUG")
            echo -e "${PURPLE}${timestamp} [${level}] ${message}${NC}"
            ;;
        "HEADER")
            echo -e "${CYAN}${timestamp} [${level}] ${message}${NC}"
            ;;
    esac
}

# Check prerequisites for initialization
check_prerequisites() {
    log "HEADER" "=== Checking Database Initialization Prerequisites ==="
    
    # Check database connection
    if [[ -z "$DB_URL" ]]; then
        log "ERROR" "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    # Check Node.js and npm
    if ! command -v node &> /dev/null; then
        log "ERROR" "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log "ERROR" "npm is not installed"
        exit 1
    fi
    
    # Check Prisma CLI
    if ! npx prisma --version &> /dev/null; then
        log "ERROR" "Prisma CLI is not available"
        exit 1
    fi
    
    # Test database connectivity
    if ! npx prisma db execute --stdin < /dev/null 2>/dev/null; then
        log "ERROR" "Cannot connect to database. Please verify credentials and network connectivity."
        exit 1
    fi
    
    # Check if project dependencies are installed
    if [[ ! -d "${PROJECT_ROOT}/node_modules" ]]; then
        log "WARN" "Node modules not found. Installing dependencies..."
        if ! npm install --production; then
            log "ERROR" "Failed to install project dependencies"
            exit 1
        fi
    fi
    
    log "SUCCESS" "All prerequisites satisfied"
}

# Check database state
check_database_state() {
    log "HEADER" "=== Checking Database State ==="
    
    # Check if database is initialized
    local migration_status
    migration_status=$(npx prisma migrate status --schema="$PROJECT_ROOT/prisma/schema.prisma" 2>&1 || echo "error")
    
    if [[ "$migration_status" == *"No pending migrations"* ]]; then
        log "SUCCESS" "Database schema is up to date"
        return 0
    elif [[ "$migration_status" == *"pending migrations"* ]]; then
        log "INFO" "Database has pending migrations"
        return 1
    elif [[ "$migration_status" == *"never been migrated"* ]]; then
        log "INFO" "Database has never been migrated"
        return 2
    else
        log "WARN" "Cannot determine database migration status: $migration_status"
        return 3
    fi
}

# Run database migrations
run_migrations() {
    if [[ "$SKIP_MIGRATION" == "true" ]]; then
        log "INFO" "Skipping database migration as requested"
        return 0
    fi
    
    log "HEADER" "=== Running Database Migrations ==="
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute migrations now"
        return 0
    fi
    
    log "INFO" "Deploying database migrations..."
    
    if npx prisma migrate deploy --schema="$PROJECT_ROOT/prisma/schema.prisma" 2>&1 | tee -a "$INIT_LOG"; then
        log "SUCCESS" "Database migrations completed successfully"
    else
        log "ERROR" "Database migration failed"
        exit 1
    fi
    
    # Generate Prisma client
    log "INFO" "Generating Prisma client..."
    if npx prisma generate --schema="$PROJECT_ROOT/prisma/schema.prisma" 2>&1 | tee -a "$INIT_LOG"; then
        log "SUCCESS" "Prisma client generated successfully"
    else
        log "ERROR" "Prisma client generation failed"
        exit 1
    fi
}

# Create production seed data
create_seed_data() {
    log "HEADER" "=== Creating Production Seed Data ==="
    
    # Create seed data directory
    mkdir -p "$SEED_DATA_DIR"
    
    # Create categories seed data
    create_categories_seed
    
    # Create services seed data
    create_services_seed
    
    # Create use case templates seed data
    create_templates_seed
    
    # Create recommendation patterns seed data
    create_patterns_seed
}

# Create categories seed data
create_categories_seed() {
    log "INFO" "Creating categories seed data..."
    
    cat > "${SEED_DATA_DIR}/categories.json" << 'EOF'
{
  "categories": [
    {
      "name": "Databases",
      "slug": "databases",
      "description": "Database management systems and data storage solutions including SQL and NoSQL databases",
      "icon": "database",
      "sortOrder": 1
    },
    {
      "name": "Web Servers",
      "slug": "web-servers",
      "description": "HTTP servers, reverse proxies, and web infrastructure components",
      "icon": "server",
      "sortOrder": 2
    },
    {
      "name": "Media",
      "slug": "media",
      "description": "Media streaming, processing, and management applications for audio, video, and images",
      "icon": "play-circle",
      "sortOrder": 3
    },
    {
      "name": "Development Tools",
      "slug": "development-tools",
      "description": "Development environments, version control systems, and build tools",
      "icon": "code",
      "sortOrder": 4
    },
    {
      "name": "Monitoring",
      "slug": "monitoring",
      "description": "System monitoring, logging, observability tools, and performance tracking",
      "icon": "activity",
      "sortOrder": 5
    },
    {
      "name": "Security",
      "slug": "security",
      "description": "Security tools, firewalls, authentication services, and vulnerability scanners",
      "icon": "shield",
      "sortOrder": 6
    },
    {
      "name": "Productivity",
      "slug": "productivity",
      "description": "Collaboration tools, document management, project management, and productivity applications",
      "icon": "briefcase",
      "sortOrder": 7
    },
    {
      "name": "Analytics",
      "slug": "analytics",
      "description": "Data analytics, business intelligence, and reporting tools",
      "icon": "trending-up",
      "sortOrder": 8
    },
    {
      "name": "Communication",
      "slug": "communication",
      "description": "Communication platforms, chat systems, and collaboration tools",
      "icon": "message-circle",
      "sortOrder": 9
    },
    {
      "name": "Storage",
      "slug": "storage",
      "description": "File storage, object storage, and distributed storage systems",
      "icon": "hard-drive",
      "sortOrder": 10
    }
  ]
}
EOF
    
    log "SUCCESS" "Categories seed data created"
}

# Create popular services seed data
create_services_seed() {
    log "INFO" "Creating services seed data..."
    
    cat > "${SEED_DATA_DIR}/services.json" << 'EOF'
{
  "services": [
    {
      "name": "PostgreSQL",
      "slug": "postgresql",
      "description": "Advanced open-source relational database with excellent performance, reliability, and feature robustness",
      "dockerImage": "postgres:16-alpine",
      "version": "16.1",
      "category_slug": "databases",
      "ports": [
        {
          "containerPort": 5432,
          "protocol": "tcp",
          "description": "PostgreSQL database port"
        }
      ],
      "environmentVariables": [
        {
          "name": "POSTGRES_PASSWORD",
          "required": true,
          "type": "password",
          "description": "Password for the PostgreSQL superuser"
        },
        {
          "name": "POSTGRES_DB",
          "required": false,
          "type": "string",
          "description": "Name of the default database to create",
          "defaultValue": "postgres"
        },
        {
          "name": "POSTGRES_USER",
          "required": false,
          "type": "string",
          "description": "PostgreSQL superuser name",
          "defaultValue": "postgres"
        }
      ],
      "resourceRequirements": {
        "minCpu": 0.5,
        "recommendedCpu": 2.0,
        "minMemory": 512,
        "recommendedMemory": 2048,
        "storageRequired": true,
        "minimumStorage": 1024
      },
      "compatibilityInfo": {
        "operatingSystems": ["linux"],
        "architectures": ["amd64", "arm64"],
        "minDockerVersion": "20.10.0"
      },
      "documentationUrl": "https://hub.docker.com/_/postgres",
      "featured": true,
      "status": "approved"
    },
    {
      "name": "Redis",
      "slug": "redis",
      "description": "In-memory data structure store used as a database, cache, and message broker",
      "dockerImage": "redis:7-alpine",
      "version": "7.2.4",
      "category_slug": "databases",
      "ports": [
        {
          "containerPort": 6379,
          "protocol": "tcp",
          "description": "Redis server port"
        }
      ],
      "environmentVariables": [
        {
          "name": "REDIS_PASSWORD",
          "required": false,
          "type": "password",
          "description": "Optional password for Redis authentication"
        }
      ],
      "resourceRequirements": {
        "minCpu": 0.25,
        "recommendedCpu": 1.0,
        "minMemory": 256,
        "recommendedMemory": 1024,
        "storageRequired": false
      },
      "compatibilityInfo": {
        "operatingSystems": ["linux"],
        "architectures": ["amd64", "arm64", "arm/v7"],
        "minDockerVersion": "20.10.0"
      },
      "documentationUrl": "https://hub.docker.com/_/redis",
      "featured": true,
      "status": "approved"
    },
    {
      "name": "Nginx",
      "slug": "nginx",
      "description": "High-performance web server, reverse proxy, and load balancer",
      "dockerImage": "nginx:alpine",
      "version": "1.25",
      "category_slug": "web-servers",
      "ports": [
        {
          "containerPort": 80,
          "protocol": "tcp",
          "description": "HTTP port"
        },
        {
          "containerPort": 443,
          "protocol": "tcp",
          "description": "HTTPS port"
        }
      ],
      "environmentVariables": [],
      "resourceRequirements": {
        "minCpu": 0.1,
        "recommendedCpu": 0.5,
        "minMemory": 64,
        "recommendedMemory": 256,
        "storageRequired": false
      },
      "compatibilityInfo": {
        "operatingSystems": ["linux"],
        "architectures": ["amd64", "arm64", "arm/v7"],
        "minDockerVersion": "20.10.0"
      },
      "documentationUrl": "https://hub.docker.com/_/nginx",
      "featured": true,
      "status": "approved"
    },
    {
      "name": "Grafana",
      "slug": "grafana",
      "description": "Open-source analytics and monitoring platform with rich visualization capabilities",
      "dockerImage": "grafana/grafana:latest",
      "version": "10.2.0",
      "category_slug": "monitoring",
      "ports": [
        {
          "containerPort": 3000,
          "protocol": "tcp",
          "description": "Grafana web interface"
        }
      ],
      "environmentVariables": [
        {
          "name": "GF_SECURITY_ADMIN_PASSWORD",
          "required": true,
          "type": "password",
          "description": "Admin password for Grafana"
        }
      ],
      "resourceRequirements": {
        "minCpu": 0.2,
        "recommendedCpu": 1.0,
        "minMemory": 256,
        "recommendedMemory": 512,
        "storageRequired": true,
        "minimumStorage": 512
      },
      "compatibilityInfo": {
        "operatingSystems": ["linux"],
        "architectures": ["amd64", "arm64"],
        "minDockerVersion": "20.10.0"
      },
      "documentationUrl": "https://grafana.com/docs/grafana/latest/",
      "featured": true,
      "status": "approved"
    }
  ]
}
EOF
    
    log "SUCCESS" "Services seed data created"
}

# Create use case templates seed data
create_templates_seed() {
    log "INFO" "Creating use case templates seed data..."
    
    cat > "${SEED_DATA_DIR}/templates.json" << 'EOF'
{
  "templates": [
    {
      "name": "Full Stack Web Application",
      "description": "Complete web application stack with database, cache, and monitoring",
      "category": "development",
      "difficulty": "intermediate",
      "estimatedSetupTime": "45-60 minutes",
      "serviceIds": ["postgresql", "redis", "nginx", "grafana"],
      "featured": true,
      "metadata": {
        "tags": ["web", "database", "cache", "monitoring"],
        "useCase": "Building modern web applications with full observability",
        "complexity": "medium"
      }
    },
    {
      "name": "Database Cluster",
      "description": "High-availability database setup with primary-replica configuration",
      "category": "databases",
      "difficulty": "advanced",
      "estimatedSetupTime": "90-120 minutes",
      "serviceIds": ["postgresql", "redis"],
      "featured": true,
      "metadata": {
        "tags": ["database", "cluster", "high-availability"],
        "useCase": "Production database setup with redundancy",
        "complexity": "high"
      }
    },
    {
      "name": "Monitoring Stack",
      "description": "Complete monitoring and observability solution",
      "category": "monitoring",
      "difficulty": "intermediate",
      "estimatedSetupTime": "30-45 minutes",
      "serviceIds": ["grafana"],
      "featured": true,
      "metadata": {
        "tags": ["monitoring", "metrics", "alerting"],
        "useCase": "System monitoring and alerting setup",
        "complexity": "medium"
      }
    },
    {
      "name": "Simple Web Server",
      "description": "Basic web server setup for static content or reverse proxy",
      "category": "web",
      "difficulty": "beginner",
      "estimatedSetupTime": "15-20 minutes",
      "serviceIds": ["nginx"],
      "featured": false,
      "metadata": {
        "tags": ["web", "proxy", "static"],
        "useCase": "Simple web hosting or reverse proxy",
        "complexity": "low"
      }
    }
  ]
}
EOF
    
    log "SUCCESS" "Templates seed data created"
}

# Create recommendation patterns seed data
create_patterns_seed() {
    log "INFO" "Creating recommendation patterns seed data..."
    
    cat > "${SEED_DATA_DIR}/patterns.json" << 'EOF'
{
  "patterns": [
    {
      "service_slugs": ["postgresql", "redis"],
      "frequency": 850,
      "successRate": 0.94,
      "category": "database",
      "minStackSize": 2,
      "maxStackSize": 5,
      "metadata": {
        "description": "PostgreSQL with Redis caching layer",
        "commonUseCase": "High-performance web applications"
      }
    },
    {
      "service_slugs": ["nginx", "postgresql"],
      "frequency": 720,
      "successRate": 0.91,
      "category": "web",
      "minStackSize": 2,
      "maxStackSize": 4,
      "metadata": {
        "description": "Nginx reverse proxy with PostgreSQL backend",
        "commonUseCase": "Web applications with database"
      }
    },
    {
      "service_slugs": ["grafana", "postgresql"],
      "frequency": 450,
      "successRate": 0.88,
      "category": "monitoring",
      "minStackSize": 2,
      "maxStackSize": 3,
      "metadata": {
        "description": "Grafana with PostgreSQL for metrics storage",
        "commonUseCase": "Monitoring and analytics setup"
      }
    },
    {
      "service_slugs": ["nginx", "redis", "postgresql"],
      "frequency": 380,
      "successRate": 0.92,
      "category": "web",
      "minStackSize": 3,
      "maxStackSize": 6,
      "metadata": {
        "description": "Complete web stack with caching",
        "commonUseCase": "High-performance web applications"
      }
    }
  ]
}
EOF
    
    log "SUCCESS" "Patterns seed data created"
}

# Run database seeding
run_seeding() {
    if [[ "$SKIP_SEED" == "true" ]]; then
        log "INFO" "Skipping database seeding as requested"
        return 0
    fi
    
    log "HEADER" "=== Running Database Seeding ==="
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute seeding now"
        return 0
    fi
    
    # Create custom seeding script
    create_production_seed_script
    
    # Run the seeding
    log "INFO" "Seeding database with production data..."
    
    if NODE_ENV="$NODE_ENV" node "${SEED_DATA_DIR}/production-seed.js" 2>&1 | tee -a "$INIT_LOG"; then
        log "SUCCESS" "Database seeding completed successfully"
    else
        log "ERROR" "Database seeding failed"
        exit 1
    fi
}

# Create production seeding script
create_production_seed_script() {
    log "INFO" "Creating production seeding script..."
    
    cat > "${SEED_DATA_DIR}/production-seed.js" << 'EOF'
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Load seed data files
const categoriesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'categories.json'), 'utf8'));
const servicesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'services.json'), 'utf8'));
const templatesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'templates.json'), 'utf8'));
const patternsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'patterns.json'), 'utf8'));

async function main() {
  console.log('🌱 Starting production database seeding...');
  
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connection established');
    
    // Seed categories
    console.log('📂 Seeding categories...');
    const categoryMap = {};
    
    for (const categoryData of categoriesData.categories) {
      const category = await prisma.category.upsert({
        where: { slug: categoryData.slug },
        update: {
          name: categoryData.name,
          description: categoryData.description,
          icon: categoryData.icon,
          sortOrder: categoryData.sortOrder
        },
        create: categoryData
      });
      
      categoryMap[categoryData.slug] = category.id;
      console.log(`  ✓ ${category.name} (${category.slug})`);
    }
    
    // Seed services
    console.log('🐳 Seeding services...');
    const serviceMap = {};
    
    for (const serviceData of servicesData.services) {
      const categoryId = categoryMap[serviceData.category_slug];
      if (!categoryId) {
        console.warn(`  ⚠ Category not found for service: ${serviceData.name}`);
        continue;
      }
      
      const serviceDataToUpsert = {
        name: serviceData.name,
        slug: serviceData.slug,
        description: serviceData.description,
        dockerImage: serviceData.dockerImage,
        version: serviceData.version,
        categoryId: categoryId,
        ports: JSON.stringify(serviceData.ports || []),
        environmentVariables: JSON.stringify(serviceData.environmentVariables || []),
        resourceRequirements: JSON.stringify(serviceData.resourceRequirements || {}),
        compatibilityInfo: JSON.stringify(serviceData.compatibilityInfo || {}),
        documentationUrl: serviceData.documentationUrl,
        featured: serviceData.featured || false,
        status: serviceData.status || 'approved'
      };
      
      const service = await prisma.service.upsert({
        where: { slug: serviceData.slug },
        update: serviceDataToUpsert,
        create: serviceDataToUpsert
      });
      
      serviceMap[serviceData.slug] = service.id;
      console.log(`  ✓ ${service.name} (${service.slug})`);
    }
    
    // Seed use case templates
    console.log('📋 Seeding use case templates...');
    
    for (const templateData of templatesData.templates) {
      // Map service slugs to IDs
      const serviceIds = templateData.serviceIds
        .map(slug => serviceMap[slug])
        .filter(id => id !== undefined);
      
      if (serviceIds.length !== templateData.serviceIds.length) {
        console.warn(`  ⚠ Some services not found for template: ${templateData.name}`);
      }
      
      const templateDataToUpsert = {
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        difficulty: templateData.difficulty,
        estimatedSetupTime: templateData.estimatedSetupTime,
        serviceIds: JSON.stringify(serviceIds),
        featured: templateData.featured || false,
        metadata: JSON.stringify(templateData.metadata || {})
      };
      
      const template = await prisma.useCaseTemplate.upsert({
        where: { name: templateData.name },
        update: templateDataToUpsert,
        create: templateDataToUpsert
      });
      
      console.log(`  ✓ ${template.name}`);
    }
    
    // Seed recommendation patterns
    console.log('🔍 Seeding recommendation patterns...');
    
    for (const patternData of patternsData.patterns) {
      // Map service slugs to IDs
      const serviceIds = patternData.service_slugs
        .map(slug => serviceMap[slug])
        .filter(id => id !== undefined);
      
      if (serviceIds.length !== patternData.service_slugs.length) {
        console.warn(`  ⚠ Some services not found for pattern: ${patternData.service_slugs.join(', ')}`);
        continue;
      }
      
      const patternDataToUpsert = {
        serviceIds: JSON.stringify(serviceIds),
        frequency: patternData.frequency,
        successRate: patternData.successRate,
        category: patternData.category,
        minStackSize: patternData.minStackSize,
        maxStackSize: patternData.maxStackSize,
        metadata: JSON.stringify(patternData.metadata || {})
      };
      
      // Check if pattern already exists
      const existingPattern = await prisma.recommendationPattern.findFirst({
        where: {
          serviceIds: JSON.stringify(serviceIds),
          category: patternData.category
        }
      });
      
      if (existingPattern) {
        await prisma.recommendationPattern.update({
          where: { id: existingPattern.id },
          data: patternDataToUpsert
        });
        console.log(`  ✓ Updated pattern: ${patternData.service_slugs.join(', ')}`);
      } else {
        await prisma.recommendationPattern.create({
          data: patternDataToUpsert
        });
        console.log(`  ✓ Created pattern: ${patternData.service_slugs.join(', ')}`);
      }
    }
    
    console.log('🎉 Production database seeding completed successfully!');
    
    // Print summary
    const counts = await Promise.all([
      prisma.category.count(),
      prisma.service.count(),
      prisma.useCaseTemplate.count(),
      prisma.recommendationPattern.count()
    ]);
    
    console.log('\n📊 Database Summary:');
    console.log(`  Categories: ${counts[0]}`);
    console.log(`  Services: ${counts[1]}`);
    console.log(`  Templates: ${counts[2]}`);
    console.log(`  Patterns: ${counts[3]}`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
EOF
    
    log "SUCCESS" "Production seeding script created"
}

# Verify database integrity
verify_database() {
    log "HEADER" "=== Verifying Database Integrity ==="
    
    log "INFO" "Running database connectivity test..."
    if ! npx prisma db execute --stdin < /dev/null 2>/dev/null; then
        log "ERROR" "Database connectivity test failed"
        exit 1
    fi
    
    log "INFO" "Verifying schema consistency..."
    if ! npx prisma validate --schema="$PROJECT_ROOT/prisma/schema.prisma" 2>&1 | tee -a "$INIT_LOG"; then
        log "ERROR" "Schema validation failed"
        exit 1
    fi
    
    log "INFO" "Testing basic database operations..."
    if node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        async function test() {
          try {
            const categoryCount = await prisma.category.count();
            const serviceCount = await prisma.service.count();
            
            console.log(\`Categories: \${categoryCount}\`);
            console.log(\`Services: \${serviceCount}\`);
            
            if (categoryCount === 0 && serviceCount === 0) {
              console.log('Warning: Database appears to be empty');
              process.exit(1);
            }
            
            console.log('Database integrity verification passed');
            process.exit(0);
          } catch (error) {
            console.error('Database test failed:', error.message);
            process.exit(1);
          } finally {
            await prisma.\$disconnect();
          }
        }
        
        test();
    " 2>&1 | tee -a "$INIT_LOG"; then
        log "SUCCESS" "Database integrity verification passed"
    else
        log "ERROR" "Database integrity verification failed"
        exit 1
    fi
}

# Generate initialization report
generate_init_report() {
    log "HEADER" "=== Generating Initialization Report ==="
    
    local report_file="${PROJECT_ROOT}/logs/db-init-report-$(date +%Y%m%d-%H%M%S).json"
    
    # Get database statistics
    local db_stats
    db_stats=$(node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        async function getStats() {
          try {
            const stats = {
              categories: await prisma.category.count(),
              services: await prisma.service.count(),
              templates: await prisma.useCaseTemplate.count(),
              patterns: await prisma.recommendationPattern.count(),
              featured_services: await prisma.service.count({ where: { featured: true } }),
              featured_templates: await prisma.useCaseTemplate.count({ where: { featured: true } })
            };
            console.log(JSON.stringify(stats));
          } catch (error) {
            console.log(JSON.stringify({ error: error.message }));
          } finally {
            await prisma.\$disconnect();
          }
        }
        
        getStats();
    " 2>/dev/null)
    
    cat > "$report_file" << EOF
{
  "database_initialization_report": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "database": {
      "provider": "$DB_PROVIDER",
      "url_set": $([ -n "$DB_URL" ] && echo "true" || echo "false"),
      "environment": "$NODE_ENV"
    },
    "initialization": {
      "seed_level": "$SEED_LEVEL",
      "dry_run": $DRY_RUN,
      "force_init": $FORCE_INIT,
      "skip_migration": $SKIP_MIGRATION,
      "skip_seed": $SKIP_SEED
    },
    "statistics": $db_stats,
    "logs": {
      "init_log": "$INIT_LOG",
      "report_file": "$report_file"
    }
  }
}
EOF
    
    log "SUCCESS" "Initialization report generated: $report_file"
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Production database initialization and seeding script.

Options:
  --force                Force initialization even if database has data
  --skip-migration       Skip database migration step
  --skip-seed            Skip database seeding step
  --seed-level LEVEL     Seeding level: minimal, development, production (default: production)
  --dry-run              Simulate initialization without making changes
  --help                 Show this help message

Environment Variables:
  DATABASE_URL           Database connection URL (required)
  DB_PROVIDER           Database provider (postgresql, sqlite)
  NODE_ENV              Environment (affects seeding behavior)

Examples:
  $0                           # Full production initialization
  $0 --skip-migration         # Skip migrations, seed only
  $0 --seed-level minimal     # Minimal seed data only
  $0 --dry-run                # Simulate without changes

EOF
}

# Main function
main() {
    # Create logs directory
    mkdir -p "${PROJECT_ROOT}/logs"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                FORCE_INIT=true
                shift
                ;;
            --skip-migration)
                SKIP_MIGRATION=true
                shift
                ;;
            --skip-seed)
                SKIP_SEED=true
                shift
                ;;
            --seed-level)
                SEED_LEVEL="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    log "HEADER" "🗄️ Production Database Initialization"
    log "INFO" "Initialization log: $INIT_LOG"
    log "INFO" "Seed level: $SEED_LEVEL"
    log "INFO" "Environment: $NODE_ENV"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "*** DRY RUN MODE - No changes will be made ***"
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Check database state
    local db_state_code
    check_database_state
    db_state_code=$?
    
    # Handle existing data
    if [[ $db_state_code -eq 0 && "$FORCE_INIT" != "true" && "$SKIP_MIGRATION" != "true" ]]; then
        log "INFO" "Database already initialized. Use --force to reinitialize or --skip-migration to seed only"
    fi
    
    # Create seed data
    create_seed_data
    
    # Run migrations if needed
    if [[ $db_state_code -ne 0 || "$FORCE_INIT" == "true" ]]; then
        run_migrations
    fi
    
    # Run seeding
    run_seeding
    
    # Verify database integrity
    verify_database
    
    # Generate report
    generate_init_report
    
    log "SUCCESS" "🎉 Database initialization completed successfully"
    
    # Show summary
    log "INFO" "Initialization log: $INIT_LOG"
    log "INFO" "Use 'npx prisma studio' to explore the seeded data"
    
    exit 0
}

# Run main function with all arguments
main "$@"