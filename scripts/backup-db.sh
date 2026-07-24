#!/bin/bash
# Stapelwerk Database Backup Script
# Creates compressed backups with automatic rotation

set -e

# Configuration
BACKUP_DIR="/opt/stapelwerk/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/postgres_backup_$DATE.sql.gz"
RETENTION_DAYS=7
LOG_FILE="/opt/stapelwerk/logs/backup.log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "${GREEN}Starting database backup...${NC}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# Load environment variables
if [ -f /opt/stapelwerk/.env.production ]; then
    source /opt/stapelwerk/.env.production
else
    log "${RED}Error: .env.production not found${NC}"
    exit 1
fi

# Extract database credentials
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# Create backup
log "Creating backup: $BACKUP_FILE"
if docker exec stapelwerk_postgres pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "${GREEN}✓ Backup created successfully ($BACKUP_SIZE)${NC}"
else
    log "${RED}✗ Backup failed!${NC}"
    exit 1
fi

# Verify backup integrity
log "Verifying backup integrity..."
if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
    log "${GREEN}✓ Backup integrity verified${NC}"
else
    log "${RED}✗ Backup file is corrupted!${NC}"
    exit 1
fi

# Rotate old backups
log "Rotating old backups (keeping last $RETENTION_DAYS days)..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "postgres_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
log "${GREEN}✓ Deleted $DELETED_COUNT old backup(s)${NC}"

# List current backups
log "Current backups:"
ls -lh "$BACKUP_DIR"/postgres_backup_*.sql.gz 2>/dev/null | tail -5 | tee -a "$LOG_FILE" || log "No backups found"

# Summary
TOTAL_BACKUPS=$(ls -1 "$BACKUP_DIR"/postgres_backup_*.sql.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
log "${GREEN}Backup complete! Total backups: $TOTAL_BACKUPS, Total size: $TOTAL_SIZE${NC}"

exit 0
