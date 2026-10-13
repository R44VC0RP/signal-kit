#!/usr/bin/env bash
# Copies the VM's nightly database dumps to this machine so a copy exists off the box.
# Runs daily from cronctl on Ryan's Mac (job "signalkit-backup-pull"); keeps the newest 30.
set -euo pipefail

SSH="${SSH:-$HOME/.local/bin/pssh}"
HOST="${HOST:-signal.exe.xyz}"
DEST="${DEST:-$HOME/Backups/signalkit}"
KEEP="${KEEP:-30}"

mkdir -p "$DEST"
chmod 700 "$DEST"
umask 077

copied=0
for name in $("$SSH" "$HOST" 'ls -1 ~/backups/signalkit-*.sql.gz 2>/dev/null | xargs -r -n1 basename'); do
  [[ "$name" =~ ^signalkit-[0-9]{8}-[0-9]{6}\.sql\.gz$ ]] || continue
  [ -s "$DEST/$name" ] && continue
  "$SSH" "$HOST" "cat ~/backups/$name" > "$DEST/$name.partial"
  gzip -t "$DEST/$name.partial"
  mv "$DEST/$name.partial" "$DEST/$name"
  copied=$((copied + 1))
done

ls -1t "$DEST"/signalkit-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "Copied $copied new backup(s) to $DEST"
