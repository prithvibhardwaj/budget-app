#!/usr/bin/env bash
# Snapshots the backend data volume (SQLite DB, master.key, WhatsApp sessions).
# Losing master.key makes existing expense descriptions permanently unreadable,
# so keep these backups somewhere off the server.
#
# Install as a daily cron job:
#   crontab -e
#   0 3 * * * /home/ubuntu/budget-app/deploy/backup.sh >> /home/ubuntu/backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/budget-backups}"
KEEP=14

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)

docker run --rm \
  -v deploy_budget-data:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/budget-$STAMP.tar.gz" -C /data .

# Keep only the most recent $KEEP archives
ls -1t "$BACKUP_DIR"/budget-*.tar.gz | tail -n +$((KEEP + 1)) | xargs -r rm --

echo "Backed up to $BACKUP_DIR/budget-$STAMP.tar.gz"
