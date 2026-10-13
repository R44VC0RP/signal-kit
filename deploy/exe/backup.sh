#!/usr/bin/env bash
# Nightly MySQL dump on the exe.dev VM (cron: see deploy/exe/README.md).
# Writes ~/backups/signalkit-<UTC timestamp>.sql.gz and keeps the newest 14.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/signal-kit}"
export SIGNAL_KIT_ENV_FILE="${SIGNAL_KIT_ENV_FILE:-$HOME/signalkit.env}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP="${KEEP:-14}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077

stamp="$(date -u +%Y%m%d-%H%M%S)"
out="$BACKUP_DIR/signalkit-$stamp.sql.gz"
tmp="$out.partial"

cd "$APP_DIR"
docker compose -f deploy/exe/compose.yml exec -T mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --no-tablespaces "$MYSQL_DATABASE"' \
  2> >(grep -v "Using a password on the command line" >&2) | gzip -9 > "$tmp"

# A dump that didn't finish has no completion marker; never keep it as a backup.
if ! gzip -dc "$tmp" | tail -n 1 | grep -q "Dump completed"; then
  rm -f "$tmp"
  echo "Backup failed: incomplete dump" >&2
  exit 1
fi
mv "$tmp" "$out"

ls -1t "$BACKUP_DIR"/signalkit-*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "Backup written: $out ($(du -h "$out" | cut -f1))"
