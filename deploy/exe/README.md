# Production on exe.dev

- VM: `signal` (personal exe.dev account), `ssh signal.exe.xyz`
- URL: https://signal.ryan.ceo (CNAME → `signal.exe.xyz`, registered with `ssh exe.dev domain add signal signal.ryan.ceo`)
- App + MySQL run with `deploy/exe/compose.yml`; the checkout is `~/signal-kit`, secrets are in `~/signalkit.env` (mode 600).

## Deploys

Every push to `main` runs CI (type check, lint, build). If it passes, the workflow calls
`https://exe.dev/exec` with the `EXE_DEPLOY_TOKEN` secret, an exe.dev API token limited to
`ssh signal`, which runs `deploy/exe/deploy.sh <sha>`: fetch, build, migrate, restart, health check.

Manual deploy: `ssh signal.exe.xyz ./signal-kit/deploy/exe/deploy.sh [ref]`

Rotate the token (expires after a year):

```sh
ssh exe.dev "ssh-key generate-api-key --label=signal-deploy --cmds='ssh signal' --exp=365d --json" \
  | jq -r .token | gh secret set EXE_DEPLOY_TOKEN --repo R44VC0RP/signal-kit
```

## Environment (`~/signalkit.env`)

`BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_SECRET`, `DATABASE_URL`,
`MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`,
`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
optional `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_LIVESTREAM_ENABLED`.

## Database and backups

MySQL lives in the `signalkit_mysql-data` Docker volume on the VM.

- **Nightly on the VM** (cron, 03:15 UTC): `deploy/exe/backup.sh` writes
  `~/backups/signalkit-<UTC>.sql.gz` (mode 600) and keeps the newest 14. Incomplete dumps are discarded.
- **Off the box**: Ryan's Mac runs `deploy/exe/pull-backups.sh` daily via cronctl
  (job `signalkit-backup-pull`, catches up after sleep) and keeps the newest 30 in `~/Backups/signalkit`.

Restore into the running database (overwrites it):

```sh
gunzip -c signalkit-YYYYMMDD-HHMMSS.sql.gz | ssh signal.exe.xyz 'cd signal-kit && \
  SIGNAL_KIT_ENV_FILE=~/signalkit.env docker compose -f deploy/exe/compose.yml exec -T mysql \
  sh -c "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" \"\$MYSQL_DATABASE\""'
```
