#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${LH_ENV_FILE:-/opt/lh-licensing/compose/.env}"

docker compose \
  --env-file "$ENV_FILE" \
  -f "$ROOT_DIR/deploy/compose/compose.preprod.yml" \
  up -d --build --remove-orphans
