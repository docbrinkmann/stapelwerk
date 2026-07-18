# Cron Job Setup for Automated Backups

This guide explains how to set up automated database backups using cron.

## Setup Instructions

### 1. Make Backup Script Executable

```bash
chmod +x /opt/build-my-stack/scripts/backup-db.sh
```

### 2. Test Backup Script

```bash
# Test the backup script manually
cd /opt/build-my-stack
./scripts/backup-db.sh

# Check if backup was created
ls -lh backups/

# Check log file
tail -f logs/backup.log
```

### 3. Add Cron Job

```bash
# Open crontab editor
crontab -e
```

Add this line to run backups daily at 2 AM:

```cron
# BuildMyStack Daily Database Backup (2 AM)
0 2 * * * /opt/build-my-stack/scripts/backup-db.sh >> /opt/build-my-stack/logs/backup.log 2>&1
```

### 4. Verify Cron Job

```bash
# List current cron jobs
crontab -l

# Check if cron service is running
systemctl status cron  # Debian/Ubuntu
systemctl status crond  # CentOS/RHEL
```

## Cron Schedule Examples

```cron
# Every 6 hours
0 */6 * * * /opt/build-my-stack/scripts/backup-db.sh

# Daily at 2 AM
0 2 * * * /opt/build-my-stack/scripts/backup-db.sh

# Twice daily (2 AM and 2 PM)
0 2,14 * * * /opt/build-my-stack/scripts/backup-db.sh

# Weekly on Sundays at 3 AM
0 3 * * 0 /opt/build-my-stack/scripts/backup-db.sh

# Every day at midnight
0 0 * * * /opt/build-my-stack/scripts/backup-db.sh
```

## Backup Monitoring

### Check Backup Status

```bash
# View recent backups
ls -lth /opt/build-my-stack/backups/ | head -10

# Check backup log
tail -50 /opt/build-my-stack/logs/backup.log

# Check disk space
df -h /opt/build-my-stack/backups/
```

### Test Backup Restoration

```bash
# Extract backup file
gunzip -c /opt/build-my-stack/backups/postgres_backup_YYYYMMDD_HHMMSS.sql.gz > restore.sql

# Restore to database (CAUTION: This will overwrite data!)
docker exec -i build-my-stack_postgres psql -U buildmystack_user -d buildmystack < restore.sql

# Clean up
rm restore.sql
```

## Backup Rotation

The backup script automatically:
- Keeps backups for 7 days (configurable)
- Deletes backups older than retention period
- Creates compressed backups (.gz format)

To change retention period, edit `scripts/backup-db.sh`:

```bash
RETENTION_DAYS=7  # Change this value
```

## Troubleshooting

### Cron Job Not Running

```bash
# Check cron logs
tail -f /var/log/syslog | grep CRON  # Ubuntu/Debian
tail -f /var/log/cron                # CentOS/RHEL

# Check cron service
systemctl status cron
systemctl restart cron
```

### Permission Issues

```bash
# Ensure scripts are executable
chmod +x /opt/build-my-stack/scripts/*.sh

# Ensure directories are writable
chmod 755 /opt/build-my-stack/backups
chmod 755 /opt/build-my-stack/logs
```

### Disk Space Issues

```bash
# Check disk space
df -h /opt/build-my-stack

# Manually clean old backups
find /opt/build-my-stack/backups -name "*.sql.gz" -mtime +30 -delete
```

## Email Notifications (Optional)

To receive email notifications for backup failures:

1. Install mail utilities:
```bash
sudo apt-get install mailutils
```

2. Update cron job:
```cron
MAILTO=your-email@example.com
0 2 * * * /opt/build-my-stack/scripts/backup-db.sh
```

3. Configure mail server (postfix, sendmail, etc.)

## Backup to Remote Storage (Optional)

For additional safety, sync backups to remote storage:

```bash
# Example: AWS S3
aws s3 sync /opt/build-my-stack/backups/ s3://your-bucket/buildmystack-backups/

# Example: rsync to remote server
rsync -avz /opt/build-my-stack/backups/ user@backup-server:/backups/buildmystack/
```

Add to crontab after backup job:
```cron
# Backup to S3 daily at 3 AM (after local backup)
0 3 * * * aws s3 sync /opt/build-my-stack/backups/ s3://your-bucket/buildmystack-backups/
```

## Verification Checklist

- [ ] Backup script is executable
- [ ] Backup script runs without errors
- [ ] Backup files are created in correct location
- [ ] Backup files are compressed (.gz)
- [ ] Cron job is added to crontab
- [ ] Cron service is running
- [ ] Backup logs are being written
- [ ] Old backups are being rotated
- [ ] Sufficient disk space available
- [ ] Test restoration works

## Support

For backup issues:
- Check logs: `/opt/build-my-stack/logs/backup.log`
- Verify container: `docker compose ps postgres`
- Test manually: `./scripts/backup-db.sh`
