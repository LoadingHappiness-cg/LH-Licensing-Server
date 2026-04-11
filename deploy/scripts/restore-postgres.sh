#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/backup.sql.gz" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${LH_ENV_FILE:-/opt/lh-licensing/compose/.env}"
COMPOSE_FILE="$ROOT_DIR/deploy/compose/compose.preprod.yml"
BACKUP_FILE="$1"

set -a
source "$ENV_FILE"
set +a

gunzip -c "$BACKUP_FILE" | docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
