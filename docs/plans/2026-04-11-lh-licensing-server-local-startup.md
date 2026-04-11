# LH.Licensing.Server Local Startup

This runbook is the shortest reproducible path to validate `LH.Licensing.Server` locally against the real sample client.

## What this setup covers

- PostgreSQL via `docker compose`
- EF Core migrations
- a stable RSA key pair for JWT signing
- API startup on a predictable local URL
- sample client execution in real mode

## Prerequisites

- .NET 8 SDK installed
- `openssl` available
- Docker available, or another PostgreSQL 16+ instance reachable locally

## 1. Start PostgreSQL

The repo includes a minimal `docker-compose.yml` with PostgreSQL only:

```bash
docker compose up -d postgres
```

If you prefer a local PostgreSQL install, use these values:

- database: `lh_licensing_server`
- user: `postgres`
- password: `postgres`
- port: `5432`

## 2. Create a stable RSA key pair

Create a fixed development key pair and keep it between runs:

```bash
mkdir -p .local/secrets .local/state
openssl genrsa -out .local/secrets/lh-licensing-private.pem 2048
openssl rsa -in .local/secrets/lh-licensing-private.pem -pubout -out .local/secrets/lh-licensing-public.pem
```

The server signs JWTs with the private key.
The sample client validates JWTs with the public key.

## 3. Configure the API

Use the same values every time to avoid local drift:

```bash
export DOTNET_ROOT=/Users/carlosgavela/.dotnet
export PATH="$DOTNET_ROOT:$PATH"
export ASPNETCORE_URLS=http://localhost:5000

export ConnectionStrings__Database="Host=localhost;Port=5432;Database=lh_licensing_server;Username=postgres;Password=postgres"

export Jwt__Issuer="https://tests.loadinghappiness.local"
export Jwt__Audience="lh-licensing-api"
export Jwt__KeyId="lh-licensing-key-1"
export Jwt__PrivateKeyPemPath="$PWD/.local/secrets/lh-licensing-private.pem"
export Jwt__PublicKeyPemPath="$PWD/.local/secrets/lh-licensing-public.pem"

export Admin__ApiKey="change-me-local"
export Admin__ActorId="bootstrap-admin"
```

Important:

- `Jwt__Issuer` must match the value hard-coded in the sample client validator.
- `Jwt__Audience` must stay aligned with the sample and the server.

## 4. Apply migrations

The infrastructure project already contains the initial migrations and seed data.

```bash
dotnet tool restore
dotnet tool run dotnet-ef database update --project src/LH.Licensing.Server.Infrastructure/LH.Licensing.Server.Infrastructure.csproj --startup-project src/LH.Licensing.Server.Api/LH.Licensing.Server.Api.csproj --context AppDbContext
```

This creates and seeds:

- one `Product`
- the `TRIAL`, `STANDARD`, and `PRO` plans

## 5. Start the API

```bash
dotnet run --project src/LH.Licensing.Server.Api/LH.Licensing.Server.Api.csproj
```

Expected local URLs:

- `http://localhost:5000`
- `GET /health`
- `GET /health/ready`
- `POST /api/licenses/activate`
- `POST /api/licenses/refresh`

## 6. Run the sample client in real mode

The sample defaults to demo mode. Force real mode and point it at the API:

```bash
dotnet run --project samples/LH.Licensing.Client.Sample/LH.Licensing.Client.Sample.csproj -- \
  --real=true \
  --baseUrl=http://localhost:5000 \
  --publicKey=$PWD/.local/secrets/lh-licensing-public.pem \
  --stateFile=$PWD/.local/state/lh-licensing-client-state.json \
  --simulateTransient=false \
  --simulateRevocation=false \
  --simulateOfflineExpiry=false
```

## Expected sample flow

- first run activates the license
- the client persists the returned snapshot locally
- local JWT validation succeeds with the public key
- refresh rotates the refresh token
- revoked licenses fail on refresh
- if refresh is temporarily unavailable, the app may remain `Degraded` while `offlineGraceUntil` is valid
- once `offlineGraceUntil` passes, the app becomes `Blocked`

## Local validation checklist

- `GET /health` returns `200`
- `GET /health/ready` returns `200`
- activation succeeds for the seeded product and app pair used by the sample
- invalid license keys are rejected
- refresh with an old token is rejected after rotation
- revocation is reflected on the next refresh

## Notes

- The sample uses `LH.DESKTOP.SAMPLE` as the product code and `lh.labels.gs1.desktop` as the app id.
- The seeded product already allows that app id, so no extra backend changes are required for the local smoke test.
- Keep the RSA key pair stable between runs if you want the sample cache to remain valid.
