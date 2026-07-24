#!/bin/bash

# Database Backup and Restore Script
# Automated backup procedures with scheduling, compression, and restore capabilities

set -e

# Script Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_LOG="${PROJECT_ROOT}/logs/backup-$(date +%Y%m%d-%H%M%S).log"
BACKUP_BASE_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups/db}"

# Database Configuration
DB_URL="${DATABASE_URL:-}"
DB_PROVIDER="${DB_PROVIDER:-postgresql}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-stapelwerk}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Backup Configuration
RETENTION_DAYS=30
RETENTION_WEEKS=4
RETENTION_MONTHS=12
COMPRESS_BACKUPS=true
ENCRYPT_BACKUPS=false
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Remote Storage Configuration
REMOTE_BACKUP=false
S3_BUCKET="${S3_BACKUP_BUCKET:-}"
AZURE_CONTAINER="${AZURE_BACKUP_CONTAINER:-}"
GCS_BUCKET="${GCS_BACKUP_BUCKET:-}"

# Notification Configuration
NOTIFY_ON_FAILURE=true
NOTIFY_EMAIL="${BACKUP_NOTIFY_EMAIL:-}"
SLACK_WEBHOOK="${BACKUP_SLACK_WEBHOOK:-}"

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
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${BACKUP_LOG}"
    
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

# Send notification
send_notification() {
    local message="$1"
    local status="$2"  # success, failure, warning
    
    if [[ "$NOTIFY_ON_FAILURE" == "true" || "$status" != "failure" ]]; then
        
        # Email notification
        if [[ -n "$NOTIFY_EMAIL" ]] && command -v mail &> /dev/null; then
            local subject="Database Backup - $status"
            echo "$message" | mail -s "$subject" "$NOTIFY_EMAIL"
            log "INFO" "Email notification sent to $NOTIFY_EMAIL"
        fi
        
        # Slack notification
        if [[ -n "$SLACK_WEBHOOK" ]] && command -v curl &> /dev/null; then
            local emoji=""
            case $status in
                "success") emoji=":white_check_mark:" ;;
                "failure") emoji=":x:" ;;
                "warning") emoji=":warning:" ;;
            esac
            
            local payload="{\"text\":\"${emoji} Database Backup - ${status}\\n${message}\"}"
            curl -X POST -H 'Content-type: application/json' --data "$payload" "$SLACK_WEBHOOK" 2>/dev/null
            log "INFO" "Slack notification sent"
        fi
    fi
}

# Check prerequisites
check_prerequisites() {
    log "HEADER" "=== Checking Backup Prerequisites ==="
    
    # Check database connection
    if [[ -z "$DB_URL" ]]; then
        log "ERROR" "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    # Check required tools based on database provider
    local required_tools=()
    if [[ "$DB_PROVIDER" == "postgresql" ]]; then
        required_tools=("pg_dump" "psql")
        
        # Test PostgreSQL connection
        if ! PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t 10; then
            log "ERROR" "Cannot connect to PostgreSQL database"
            exit 1
        fi
        
    elif [[ "$DB_PROVIDER" == "sqlite" ]]; then
        required_tools=("sqlite3")
        
        # Test SQLite file access
        if [[ ! -f "${DB_URL#file:}" ]]; then
            log "ERROR" "SQLite database file not found: ${DB_URL#file:}"
            exit 1
        fi
    fi
    
    # Check for compression tools
    if [[ "$COMPRESS_BACKUPS" == "true" ]]; then
        required_tools+=("gzip")
    fi
    
    # Check for encryption tools
    if [[ "$ENCRYPT_BACKUPS" == "true" ]]; then
        required_tools+=("openssl")
        if [[ -z "$BACKUP_ENCRYPTION_KEY" ]]; then
            log "ERROR" "BACKUP_ENCRYPTION_KEY required for encryption"
            exit 1
        fi
    fi
    
    # Verify all required tools
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            exit 1
        fi
    done
    
    log "SUCCESS" "All prerequisites satisfied"
}

# Create database backup
create_backup() {
    local backup_type="${1:-manual}"  # manual, daily, weekly, monthly
    
    log "HEADER" "=== Creating Database Backup ($backup_type) ==="
    
    # Create backup directory structure
    local backup_dir="${BACKUP_BASE_DIR}/${backup_type}"
    mkdir -p "$backup_dir"
    
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_name="${DB_NAME}-${backup_type}-${timestamp}"
    local backup_file="${backup_dir}/${backup_name}"
    
    # Set backup file extension based on provider
    if [[ "$DB_PROVIDER" == "postgresql" ]]; then
        backup_file="${backup_file}.sql"
    elif [[ "$DB_PROVIDER" == "sqlite" ]]; then
        backup_file="${backup_file}.db"
    fi
    
    log "INFO" "Creating backup: $backup_file"
    
    # Create the backup
    local backup_success=false
    if [[ "$DB_PROVIDER" == "postgresql" ]]; then
        
        if PGPASSWORD="$DB_PASSWORD" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --verbose \
            --no-password \
            --format=plain \
            --no-owner \
            --no-privileges \
            --file="$backup_file" 2>> "$BACKUP_LOG"; then
            backup_success=true
        fi
        
    elif [[ "$DB_PROVIDER" == "sqlite" ]]; then
        
        if cp "${DB_URL#file:}" "$backup_file"; then
            backup_success=true
        fi
    fi
    
    if [[ "$backup_success" != "true" ]]; then
        log "ERROR" "Backup creation failed"
        send_notification "Database backup failed for $DB_NAME" "failure"
        exit 1
    fi
    
    # Get backup size
    local backup_size_bytes=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0")
    local backup_size_mb=$((backup_size_bytes / 1024 / 1024))
    
    log "SUCCESS" "Backup created successfully (${backup_size_mb}MB)"
    
    # Compress backup if enabled
    if [[ "$COMPRESS_BACKUPS" == "true" ]]; then
        log "INFO" "Compressing backup..."
        if gzip "$backup_file"; then
            backup_file="${backup_file}.gz"
            local compressed_size_bytes=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0")
            local compressed_size_mb=$((compressed_size_bytes / 1024 / 1024))
            local compression_ratio=$((100 - compressed_size_mb * 100 / backup_size_mb))
            log "SUCCESS" "Backup compressed (${compressed_size_mb}MB, ${compression_ratio}% reduction)"
        else
            log "WARN" "Backup compression failed"
        fi
    fi
    
    # Encrypt backup if enabled
    if [[ "$ENCRYPT_BACKUPS" == "true" ]]; then
        log "INFO" "Encrypting backup..."
        local encrypted_file="${backup_file}.enc"
        if echo "$BACKUP_ENCRYPTION_KEY" | openssl enc -aes-256-cbc -salt -in "$backup_file" -out "$encrypted_file" -pass stdin; then
            rm -f "$backup_file"
            backup_file="$encrypted_file"
            log "SUCCESS" "Backup encrypted"
        else
            log "WARN" "Backup encryption failed"
        fi
    fi
    
    # Upload to remote storage if configured
    if [[ "$REMOTE_BACKUP" == "true" ]]; then
        upload_to_remote "$backup_file" "$backup_type"
    fi
    
    # Create metadata file
    create_backup_metadata "$backup_file" "$backup_type" "$backup_size_mb"
    
    # Store latest backup path
    echo "$backup_file" > "${backup_dir}/.latest_backup"
    
    log "SUCCESS" "Backup process completed: $backup_file"
    
    # Send success notification
    send_notification "Database backup completed successfully\\nFile: $(basename "$backup_file")\\nSize: ${backup_size_mb}MB" "success"
}

# Create backup metadata
create_backup_metadata() {
    local backup_file="$1"
    local backup_type="$2"
    local backup_size="$3"
    
    local metadata_file="${backup_file}.meta.json"
    
    cat > "$metadata_file" << EOF
{
  "backup_info": {
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_type": "$backup_type",
    "database": {
      "provider": "$DB_PROVIDER",
      "host": "$DB_HOST",
      "port": $DB_PORT,
      "name": "$DB_NAME"
    },
    "backup_file": "$(basename "$backup_file")",
    "size_mb": $backup_size,
    "compressed": $COMPRESS_BACKUPS,
    "encrypted": $ENCRYPT_BACKUPS
  }
}
EOF
    
    log "INFO" "Backup metadata created: $metadata_file"
}

# Upload to remote storage
upload_to_remote() {
    local backup_file="$1"
    local backup_type="$2"
    
    log "INFO" "Uploading backup to remote storage..."
    
    local remote_path="stapelwerk-backups/${backup_type}/$(basename "$backup_file")"
    
    # AWS S3 upload
    if [[ -n "$S3_BUCKET" ]] && command -v aws &> /dev/null; then
        if aws s3 cp "$backup_file" "s3://${S3_BUCKET}/${remote_path}"; then
            log "SUCCESS" "Backup uploaded to S3: s3://${S3_BUCKET}/${remote_path}"
        else
            log "WARN" "S3 upload failed"
        fi
    fi
    
    # Azure Blob Storage upload
    if [[ -n "$AZURE_CONTAINER" ]] && command -v az &> /dev/null; then
        if az storage blob upload --file "$backup_file" --name "$remote_path" --container-name "$AZURE_CONTAINER"; then
            log "SUCCESS" "Backup uploaded to Azure Blob: $remote_path"
        else
            log "WARN" "Azure Blob upload failed"
        fi
    fi
    
    # Google Cloud Storage upload
    if [[ -n "$GCS_BUCKET" ]] && command -v gsutil &> /dev/null; then
        if gsutil cp "$backup_file" "gs://${GCS_BUCKET}/${remote_path}"; then
            log "SUCCESS" "Backup uploaded to GCS: gs://${GCS_BUCKET}/${remote_path}"
        else
            log "WARN" "GCS upload failed"
        fi
    fi
}

# List available backups
list_backups() {
    log "HEADER" "=== Available Database Backups ==="
    
    for backup_type in manual daily weekly monthly; do
        local backup_dir="${BACKUP_BASE_DIR}/${backup_type}"
        if [[ -d "$backup_dir" ]]; then
            echo
            log "INFO" "${backup_type^} Backups:"
            
            # Find backup files
            local backup_files=()
            if [[ "$DB_PROVIDER" == "postgresql" ]]; then
                mapfile -t backup_files < <(find "$backup_dir" -name "*.sql*" -type f | sort -r)
            elif [[ "$DB_PROVIDER" == "sqlite" ]]; then
                mapfile -t backup_files < <(find "$backup_dir" -name "*.db*" -type f | sort -r)
            fi
            
            if [[ ${#backup_files[@]} -eq 0 ]]; then
                log "INFO" "  No backups found"
            else
                for backup_file in "${backup_files[@]}"; do
                    local file_size_bytes=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0")
                    local file_size_mb=$((file_size_bytes / 1024 / 1024))
                    local file_date=$(stat -f%Sm -t%Y-%m-%d\ %H:%M "$backup_file" 2>/dev/null || stat -c%y "$backup_file" 2>/dev/null | cut -d. -f1)
                    
                    log "INFO" "  $(basename "$backup_file") - ${file_size_mb}MB - $file_date"
                    
                    # Show metadata if available
                    local metadata_file="${backup_file}.meta.json"
                    if [[ -f "$metadata_file" ]]; then
                        local backup_type_meta=$(jq -r '.backup_info.backup_type' "$metadata_file" 2>/dev/null || echo "unknown")
                        log "DEBUG" "    Type: $backup_type_meta, Compressed: $(jq -r '.backup_info.compressed' "$metadata_file" 2>/dev/null || echo "unknown")"
                    fi
                done
            fi
        fi
    done
}

# Restore database from backup
restore_backup() {
    local backup_file="$1"
    local force_restore="${2:-false}"
    
    log "HEADER" "=== Restoring Database from Backup ==="
    
    if [[ ! -f "$backup_file" ]]; then
        log "ERROR" "Backup file not found: $backup_file"
        exit 1
    fi
    
    log "INFO" "Restoring from: $backup_file"
    
    # Safety check for production
    if [[ "${NODE_ENV:-}" == "production" && "$force_restore" != "true" ]]; then
        log "WARN" "Production database restore detected. This will overwrite existing data!"
        read -p "Are you absolutely sure you want to proceed? (type 'YES' to confirm): " -r
        if [[ "$REPLY" != "YES" ]]; then
            log "INFO" "Restore cancelled by user"
            exit 0
        fi
    fi
    
    # Create pre-restore backup
    log "INFO" "Creating pre-restore backup..."
    create_backup "pre-restore"
    
    # Prepare restore file
    local restore_file="$backup_file"
    local temp_files_to_cleanup=()
    
    # Decrypt if necessary
    if [[ "$backup_file" == *.enc ]]; then
        log "INFO" "Decrypting backup file..."
        local decrypted_file="${backup_file%.enc}"
        if echo "$BACKUP_ENCRYPTION_KEY" | openssl enc -d -aes-256-cbc -in "$backup_file" -out "$decrypted_file" -pass stdin; then
            restore_file="$decrypted_file"
            temp_files_to_cleanup+=("$decrypted_file")
            log "SUCCESS" "Backup decrypted"
        else
            log "ERROR" "Failed to decrypt backup"
            exit 1
        fi
    fi
    
    # Decompress if necessary
    if [[ "$restore_file" == *.gz ]]; then
        log "INFO" "Decompressing backup file..."
        local decompressed_file="${restore_file%.gz}"
        if gunzip -c "$restore_file" > "$decompressed_file"; then
            restore_file="$decompressed_file"
            temp_files_to_cleanup+=("$decompressed_file")
            log "SUCCESS" "Backup decompressed"
        else
            log "ERROR" "Failed to decompress backup"
            exit 1
        fi
    fi
    
    # Perform restore based on database provider
    local restore_success=false
    
    if [[ "$DB_PROVIDER" == "postgresql" ]]; then
        
        log "INFO" "Restoring PostgreSQL database..."
        
        # Drop existing connections (if possible)
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
            -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
        
        # Restore database
        if PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --quiet \
            -f "$restore_file" 2>> "$BACKUP_LOG"; then
            restore_success=true
        fi
        
    elif [[ "$DB_PROVIDER" == "sqlite" ]]; then
        
        log "INFO" "Restoring SQLite database..."
        if cp "$restore_file" "${DB_URL#file:}"; then
            restore_success=true
        fi
    fi
    
    # Clean up temporary files
    for temp_file in "${temp_files_to_cleanup[@]}"; do
        rm -f "$temp_file"
    done
    
    if [[ "$restore_success" == "true" ]]; then
        log "SUCCESS" "Database restore completed successfully"
        send_notification "Database restore completed successfully from $(basename "$backup_file")" "success"
    else
        log "ERROR" "Database restore failed"
        send_notification "Database restore failed for $(basename "$backup_file")" "failure"
        exit 1
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log "HEADER" "=== Cleaning Up Old Backups ==="
    
    # Clean daily backups
    local daily_dir="${BACKUP_BASE_DIR}/daily"
    if [[ -d "$daily_dir" ]]; then
        log "INFO" "Cleaning daily backups older than $RETENTION_DAYS days"
        find "$daily_dir" -type f -mtime +${RETENTION_DAYS} -exec rm -f {} \;
    fi
    
    # Clean weekly backups
    local weekly_dir="${BACKUP_BASE_DIR}/weekly"
    if [[ -d "$weekly_dir" ]]; then
        log "INFO" "Cleaning weekly backups older than $((RETENTION_WEEKS * 7)) days"
        find "$weekly_dir" -type f -mtime +$((RETENTION_WEEKS * 7)) -exec rm -f {} \;
    fi
    
    # Clean monthly backups
    local monthly_dir="${BACKUP_BASE_DIR}/monthly"
    if [[ -d "$monthly_dir" ]]; then
        log "INFO" "Cleaning monthly backups older than $((RETENTION_MONTHS * 30)) days"
        find "$monthly_dir" -type f -mtime +$((RETENTION_MONTHS * 30)) -exec rm -f {} \;
    fi
    
    log "SUCCESS" "Backup cleanup completed"
}

# Install backup crontab
install_crontab() {
    log "HEADER" "=== Installing Backup Crontab ==="
    
    local cron_file="/tmp/stapelwerk_backup_cron"
    
    # Create cron entries
    cat > "$cron_file" << EOF
# Stapelwerk Database Backup Schedule
# Daily backup at 2:00 AM
0 2 * * * $SCRIPT_DIR/db-backup-restore.sh backup daily >> ${PROJECT_ROOT}/logs/cron-backup.log 2>&1

# Weekly backup on Sundays at 3:00 AM
0 3 * * 0 $SCRIPT_DIR/db-backup-restore.sh backup weekly >> ${PROJECT_ROOT}/logs/cron-backup.log 2>&1

# Monthly backup on 1st day at 4:00 AM
0 4 1 * * $SCRIPT_DIR/db-backup-restore.sh backup monthly >> ${PROJECT_ROOT}/logs/cron-backup.log 2>&1

# Cleanup old backups daily at 5:00 AM
0 5 * * * $SCRIPT_DIR/db-backup-restore.sh cleanup >> ${PROJECT_ROOT}/logs/cron-backup.log 2>&1
EOF
    
    # Install cron jobs
    if crontab "$cron_file"; then
        log "SUCCESS" "Backup crontab installed successfully"
        rm -f "$cron_file"
        
        # Show installed cron jobs
        log "INFO" "Installed cron jobs:"
        crontab -l | grep -A10 "Stapelwerk Database Backup"
    else
        log "ERROR" "Failed to install crontab"
        rm -f "$cron_file"
        exit 1
    fi
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 COMMAND [OPTIONS]

Database backup and restore utility with automated scheduling.

Commands:
  backup [TYPE]              Create database backup (manual, daily, weekly, monthly)
  restore BACKUP_FILE        Restore database from backup file
  list                       List available backups
  cleanup                    Clean up old backups based on retention policies
  install-cron               Install automated backup cron jobs
  test-connection            Test database connectivity

Options:
  --force                    Force operation without confirmation
  --no-compress              Disable backup compression
  --no-encrypt               Disable backup encryption
  --remote                   Enable remote storage upload
  --help                     Show this help message

Environment Variables:
  DATABASE_URL               Database connection URL
  DB_PROVIDER               Database provider (postgresql, sqlite)
  BACKUP_DIR                Custom backup directory
  BACKUP_ENCRYPTION_KEY     Encryption key for backups
  S3_BACKUP_BUCKET          AWS S3 bucket for remote backups
  BACKUP_NOTIFY_EMAIL       Email for notifications
  BACKUP_SLACK_WEBHOOK      Slack webhook for notifications

Examples:
  $0 backup daily                    # Create daily backup
  $0 restore /path/to/backup.sql.gz  # Restore from backup
  $0 list                           # Show available backups
  $0 install-cron                   # Setup automated backups

EOF
}

# Main function
main() {
    local command="$1"
    shift 2>/dev/null || true
    
    # Create logs directory
    mkdir -p "${PROJECT_ROOT}/logs"
    
    case "$command" in
        "backup")
            local backup_type="${1:-manual}"
            
            # Parse options
            while [[ $# -gt 0 ]]; do
                case $1 in
                    --no-compress)
                        COMPRESS_BACKUPS=false
                        shift
                        ;;
                    --no-encrypt)
                        ENCRYPT_BACKUPS=false
                        shift
                        ;;
                    --remote)
                        REMOTE_BACKUP=true
                        shift
                        ;;
                    *)
                        backup_type="$1"
                        shift
                        ;;
                esac
            done
            
            check_prerequisites
            create_backup "$backup_type"
            ;;
            
        "restore")
            local backup_file="$1"
            local force_restore=false
            
            if [[ -z "$backup_file" ]]; then
                log "ERROR" "Backup file path required for restore"
                show_usage
                exit 1
            fi
            
            # Parse options
            while [[ $# -gt 0 ]]; do
                case $1 in
                    --force)
                        force_restore=true
                        shift
                        ;;
                    *)
                        shift
                        ;;
                esac
            done
            
            check_prerequisites
            restore_backup "$backup_file" "$force_restore"
            ;;
            
        "list")
            list_backups
            ;;
            
        "cleanup")
            cleanup_old_backups
            ;;
            
        "install-cron")
            install_crontab
            ;;
            
        "test-connection")
            check_prerequisites
            log "SUCCESS" "Database connection test passed"
            ;;
            
        "--help"|"help"|"")
            show_usage
            exit 0
            ;;
            
        *)
            log "ERROR" "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"