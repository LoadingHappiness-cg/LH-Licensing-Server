#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${LH_ENV_FILE:-/opt/lh-licensing/compose/.env}"
NETWORK_NAME="lh-licensing-preprod_backend"

docker run --rm \
  --network "$NETWORK_NAME" \
  --env-file "$ENV_FILE" \
  -v "$ROOT_DIR:/workspace" \
  -w /workspace \
  mcr.microsoft.com/dotnet/sdk:8.0 \
  bash -lc 'dotnet tool restore && dotnet tool run dotnet-ef database update --project src/LH.Licensing.Server.Infrastructure/LH.Licensing.Server.Infrastructure.csproj --startup-project src/LH.Licensing.Server.Api/LH.Licensing.Server.Api.csproj --context AppDbContext'
