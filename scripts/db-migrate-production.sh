#!/bin/bash

# Production Database Migration Script
# Handles database migrations with backup, rollback capabilities, and safety checks

set -e

# Script Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATION_LOG="${PROJECT_ROOT}/logs/db-migration-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="${PROJECT_ROOT}/backups/db"

# Database Configuration
DB_URL="${DATABASE_URL:-}"
DB_PROVIDER="${DB_PROVIDER:-postgresql}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-stapelwerk}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Backup Configuration
BACKUP_RETENTION_DAYS=30
MAX_BACKUP_SIZE_GB=10

# Migration Settings
MIGRATION_TIMEOUT=300
DRY_RUN=false
FORCE_MIGRATION=false
SKIP_BACKUP=false
SKIP_VERIFICATION=false

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
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${MIGRATION_LOG}"
    
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

# Check prerequisites
check_prerequisites() {
    log "HEADER" "=== Checking Migration Prerequisites ==="
    
    # Check if running in production
    if [[ "${NODE_ENV:-}" != "production" && "${FORCE_MIGRATION}" != "true" ]]; then
        log "WARN" "Not running in production environment. Use --force to override."
        read -p "Continue with migration? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "INFO" "Migration cancelled by user"
            exit 0
        fi
    fi
    
    # Check required tools
    local required_tools=("prisma" "pg_dump" "psql")
    if [[ "$DB_PROVIDER" == "sqlite" ]]; then
        required_tools=("prisma" "sqlite3")
    fi
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            exit 1
        fi
    done
    
    # Check database connection
    if [[ -z "$DB_URL" ]]; then
        log "ERROR" "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    # Verify database connectivity
    if ! npx prisma db execute --stdin < /dev/null 2>/dev/null; then
        log "ERROR" "Cannot connect to database. Please verify credentials and network connectivity."
        exit 1
    fi
    
    log "SUCCESS" "All prerequisites satisfied"
}

# Create database backup
create_backup() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        log "INFO" "Skipping database backup as requested"
        return 0
    fi
    
    log "HEADER" "=== Creating Database Backup ==="
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    local backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="${BACKUP_DIR}/backup-${backup_timestamp}"
    
    if [[ "$DB_PROVIDER" == "postgresql" ]]; then
        backup_file="${backup_file}.sql"
        
        log "INFO" "Creating PostgreSQL backup..."
        if PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --verbose \
            --no-password \
            --format=plain \
            --file="$backup_file" 2>> "$MIGRATION_LOG"; then
            
            log "SUCCESS" "Database backup created: $backup_file"
            
            # Compress backup
            if gzip "$backup_file"; then
                backup_file="${backup_file}.gz"
                log "INFO" "Backup compressed: $backup_file"
            fi
            
            # Store backup info for potential rollback
            echo "$backup_file" > "${PROJECT_ROOT}/.last_backup"
            
        else
            log "ERROR" "Database backup failed"
            exit 1
        fi
        
    elif [[ "$DB_PROVIDER" == "sqlite" ]]; then
        backup_file="${backup_file}.db"
        
        log "INFO" "Creating SQLite backup..."
        if cp "${DB_URL#file:}" "$backup_file"; then
            log "SUCCESS" "SQLite backup created: $backup_file"
            echo "$backup_file" > "${PROJECT_ROOT}/.last_backup"
        else
            log "ERROR" "SQLite backup failed"
            exit 1
        fi
    fi
    
    # Verify backup size
    local backup_size_mb=$(du -m "$backup_file" | cut -f1)
    log "INFO" "Backup size: ${backup_size_mb}MB"
    
    if [[ $backup_size_mb -gt $((MAX_BACKUP_SIZE_GB * 1024)) ]]; then
        log "WARN" "Backup size exceeds ${MAX_BACKUP_SIZE_GB}GB limit"
    fi
    
    # Clean old backups
    cleanup_old_backups
}

# Clean up old backups
cleanup_old_backups() {
    log "INFO" "Cleaning up old backups (retention: ${BACKUP_RETENTION_DAYS} days)"
    
    if [[ -d "$BACKUP_DIR" ]]; then
        find "$BACKUP_DIR" -name "backup-*" -type f -mtime +${BACKUP_RETENTION_DAYS} -delete
        local cleaned=$(find "$BACKUP_DIR" -name "backup-*" -type f -mtime +${BACKUP_RETENTION_DAYS} | wc -l)
        if [[ $cleaned -gt 0 ]]; then
            log "INFO" "Cleaned up $cleaned old backup files"
        fi
    fi
}

# Check migration status
check_migration_status() {
    log "HEADER" "=== Checking Migration Status ==="
    
    # Check if there are pending migrations
    local migration_status
    migration_status=$(npx prisma migrate status --schema="$PROJECT_ROOT/prisma/schema.prisma" 2>&1 || echo "error")
    
    if [[ "$migration_status" == *"No pending migrations"* ]]; then
        log "SUCCESS" "Database is up to date - no pending migrations"
        if [[ "$FORCE_MIGRATION" != "true" ]]; then
            log "INFO" "Use --force to run migration anyway"
            exit 0
        fi
    elif [[ "$migration_status" == *"pending migrations"* ]]; then
        log "INFO" "Pending migrations detected"
        echo "$migration_status" | grep -E "Migration|Pending" | while read -r line; do
            log "INFO" "$line"
        done
    else
        log "WARN" "Cannot determine migration status: $migration_status"
    fi
}

# Run database migration
run_migration() {
    log "HEADER" "=== Running Database Migration ==="
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would execute migration now"
        log "INFO" "DRY RUN: prisma migrate deploy --schema=$PROJECT_ROOT/prisma/schema.prisma"
        return 0
    fi
    
    log "INFO" "Starting migration deployment..."
    
    # Set migration timeout
    export PRISMA_CLIENT_ENGINE_TYPE=binary
    
    # Run the migration with timeout
    if timeout "$MIGRATION_TIMEOUT" npx prisma migrate deploy \
        --schema="$PROJECT_ROOT/prisma/schema.prisma" \
        2>&1 | tee -a "$MIGRATION_LOG"; then
        
        log "SUCCESS" "Database migration completed successfully"
        
    else
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            log "ERROR" "Migration timed out after ${MIGRATION_TIMEOUT} seconds"
        else
            log "ERROR" "Migration failed with exit code: $exit_code"
        fi
        
        log "ERROR" "Migration failed - consider rolling back"
        return 1
    fi
}

# Verify migration success
verify_migration() {
    if [[ "$SKIP_VERIFICATION" == "true" ]]; then
        log "INFO" "Skipping migration verification as requested"
        return 0
    fi
    
    log "HEADER" "=== Verifying Migration Success ==="
    
    # Check database connectivity
    if ! npx prisma db execute --stdin < /dev/null 2>/dev/null; then
        log "ERROR" "Database connection failed after migration"
        return 1
    fi
    
    log "SUCCESS" "Database connectivity verified"
    
    # Generate Prisma client to verify schema
    if npx prisma generate --schema="$PROJECT_ROOT/prisma/schema.prisma" 2>&1 | tee -a "$MIGRATION_LOG"; then
        log "SUCCESS" "Prisma client generation successful"
    else
        log "ERROR" "Prisma client generation failed"
        return 1
    fi
    
    # Run basic schema validation
    if node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.\$connect()
          .then(() => { 
            console.log('Schema validation successful');
            process.exit(0);
          })
          .catch((err) => { 
            console.error('Schema validation failed:', err.message);
            process.exit(1);
          });
    " 2>&1 | tee -a "$MIGRATION_LOG"; then
        log "SUCCESS" "Schema validation passed"
    else
        log "ERROR" "Schema validation failed"
        return 1
    fi
    
    log "SUCCESS" "Migration verification completed"
}

# Rollback migration
rollback_migration() {
    log "HEADER" "=== Rolling Back Migration ==="
    
    if [[ ! -f "${PROJECT_ROOT}/.last_backup" ]]; then
        log "ERROR" "No backup information found for rollback"
        exit 1
    fi
    
    local backup_file
    backup_file=$(cat "${PROJECT_ROOT}/.last_backup")
    
    if [[ ! -f "$backup_file" ]]; then
        log "ERROR" "Backup file not found: $backup_file"
        exit 1
    fi
    
    log "INFO" "Rolling back to backup: $backup_file"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would restore from backup: $backup_file"
        return 0
    fi
    
    if [[ "$DB_PROVIDER" == "postgresql" ]]; then
        # Restore PostgreSQL backup
        local restore_file="$backup_file"
        if [[ "$backup_file" == *.gz ]]; then
            log "INFO" "Decompressing backup..."
            restore_file="${backup_file%.gz}"
            gunzip -c "$backup_file" > "$restore_file"
        fi
        
        log "INFO" "Restoring PostgreSQL database..."
        if PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --quiet \
            -f "$restore_file" 2>> "$MIGRATION_LOG"; then
            
            log "SUCCESS" "Database rollback completed"
            
            # Clean up temporary decompressed file
            if [[ "$restore_file" != "$backup_file" ]]; then
                rm -f "$restore_file"
            fi
            
        else
            log "ERROR" "Database rollback failed"
            exit 1
        fi
        
    elif [[ "$DB_PROVIDER" == "sqlite" ]]; then
        # Restore SQLite backup
        if cp "$backup_file" "${DB_URL#file:}"; then
            log "SUCCESS" "SQLite rollback completed"
        else
            log "ERROR" "SQLite rollback failed"
            exit 1
        fi
    fi
}

# Generate migration report
generate_migration_report() {
    log "HEADER" "=== Generating Migration Report ==="
    
    local report_file="${PROJECT_ROOT}/logs/migration-report-$(date +%Y%m%d-%H%M%S).json"
    
    # Get current migration status
    local migration_status
    migration_status=$(npx prisma migrate status --schema="$PROJECT_ROOT/prisma/schema.prisma" 2>&1 || echo "error")
    
    # Get database info
    local db_info
    db_info=$(node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.\$connect()
          .then(async () => {
            const result = await prisma.\$queryRaw\`SELECT version();\`;
            console.log(JSON.stringify(result));
            process.exit(0);
          })
          .catch(() => {
            console.log(JSON.stringify([{version: 'Unknown'}]));
            process.exit(0);
          });
    " 2>/dev/null || echo '[{"version": "Unknown"}]')
    
    cat > "$report_file" << EOF
{
  "migration_report": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "database": {
      "provider": "$DB_PROVIDER",
      "host": "$DB_HOST",
      "port": $DB_PORT,
      "name": "$DB_NAME",
      "version_info": $db_info
    },
    "migration": {
      "status": "$migration_status",
      "dry_run": $DRY_RUN,
      "forced": $FORCE_MIGRATION,
      "backup_created": $([ "$SKIP_BACKUP" == "true" ] && echo "false" || echo "true"),
      "verification_run": $([ "$SKIP_VERIFICATION" == "true" ] && echo "false" || echo "true")
    },
    "logs": {
      "migration_log": "$MIGRATION_LOG",
      "report_file": "$report_file"
    }
  }
}
EOF
    
    log "SUCCESS" "Migration report generated: $report_file"
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Production database migration script with backup and rollback capabilities.

Options:
  --dry-run              Simulate migration without making changes
  --force                Force migration even if database is up to date
  --skip-backup          Skip database backup (NOT RECOMMENDED)
  --skip-verification    Skip post-migration verification
  --rollback             Rollback to last backup instead of migrating
  --timeout SECONDS      Migration timeout (default: 300)
  --help                 Show this help message

Environment Variables:
  DATABASE_URL           Database connection URL (required)
  DB_PROVIDER           Database provider (postgresql, sqlite)
  DB_HOST               Database host (for PostgreSQL)
  DB_PORT               Database port (for PostgreSQL)  
  DB_NAME               Database name (for PostgreSQL)
  DB_USER               Database user (for PostgreSQL)
  DB_PASSWORD           Database password (for PostgreSQL)
  NODE_ENV              Environment (production recommended)

Examples:
  $0                           # Run production migration
  $0 --dry-run                # Simulate migration
  $0 --force --skip-backup    # Force migration without backup
  $0 --rollback               # Rollback to last backup

Backup Location: $BACKUP_DIR
Log Location: logs/

EOF
}

# Main function
main() {
    local rollback_mode=false
    
    # Create logs and backup directories
    mkdir -p "${PROJECT_ROOT}/logs" "$BACKUP_DIR"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE_MIGRATION=true
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --skip-verification)
                SKIP_VERIFICATION=true
                shift
                ;;
            --rollback)
                rollback_mode=true
                shift
                ;;
            --timeout)
                MIGRATION_TIMEOUT="$2"
                shift 2
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
    
    log "HEADER" "🗄️ Production Database Migration Script"
    log "INFO" "Migration log: $MIGRATION_LOG"
    log "INFO" "Backup directory: $BACKUP_DIR"
    log "INFO" "Database provider: $DB_PROVIDER"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "*** DRY RUN MODE - No changes will be made ***"
    fi
    
    # Handle rollback mode
    if [[ "$rollback_mode" == "true" ]]; then
        check_prerequisites
        rollback_migration
        generate_migration_report
        log "SUCCESS" "Database rollback completed"
        exit 0
    fi
    
    # Normal migration flow
    local migration_failed=false
    
    check_prerequisites
    check_migration_status
    create_backup
    
    if run_migration; then
        if verify_migration; then
            log "SUCCESS" "🎉 Database migration completed successfully"
        else
            log "ERROR" "Migration verification failed"
            migration_failed=true
        fi
    else
        log "ERROR" "Migration execution failed"
        migration_failed=true
    fi
    
    generate_migration_report
    
    if [[ "$migration_failed" == "true" ]]; then
        log "ERROR" "Migration failed - consider running rollback:"
        log "ERROR" "$0 --rollback"
        exit 1
    fi
    
    log "SUCCESS" "Migration process completed successfully"
    exit 0
}

# Run main function with all arguments
main "$@"