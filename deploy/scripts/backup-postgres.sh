#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${LH_ENV_FILE:-/opt/lh-licensing/compose/.env}"
COMPOSE_FILE="$ROOT_DIR/deploy/compose/compose.preprod.yml"
BACKUP_DIR="${LH_BACKUP_DIR:-/opt/lh-licensing/backups}"

mkdir -p "$BACKUP_DIR"
set -a
source "$ENV_FILE"
set +a

STAMP="$(date +%Y%m%d-%H%M%S)"
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_DIR/lh-licensing-server-$STAMP.sql.gz"
