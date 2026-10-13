#!/usr/bin/env bash
# Deploys Signal Kit on the exe.dev VM. Called by GitHub Actions through the exe.dev
# HTTPS API (a token limited to `ssh signal`), or by hand: ./deploy/exe/deploy.sh [git-ref]
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/signal-kit}"
export SIGNAL_KIT_ENV_FILE="${SIGNAL_KIT_ENV_FILE:-$HOME/signalkit.env}"
REF="${1:-origin/main}"

# One deploy at a time; a second trigger fails fast instead of racing.
exec 9>/tmp/signalkit-deploy.lock
if ! flock -n 9; then
  echo "Another deploy is running." >&2
  exit 1
fi

cd "$APP_DIR"
git fetch --quiet origin
git checkout --quiet --force --detach "$REF"
echo "Deploying $(git log -1 --format='%h %s')"

compose() {
  docker compose -f deploy/exe/compose.yml "$@"
}

compose build app migrate
compose up -d mysql
compose run --rm migrate
compose up -d app

for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    docker image prune -f >/dev/null
    echo "Deployed $(git rev-parse --short HEAD) and healthy."
    exit 0
  fi
  sleep 2
done

echo "App did not become healthy in 120s. Recent logs:" >&2
compose logs --tail=80 app >&2
exit 1
