# LH.Licensing.Server

Backend de licenciamento da Loading Happiness, separado dos projetos cliente.

## Stack

- .NET 8
- ASP.NET Core Web API
- PostgreSQL
- Entity Framework Core
- Serilog

## Solution

- `src/LH.Licensing.Server.Api`
- `src/LH.Licensing.Server.Application`
- `src/LH.Licensing.Server.Domain`
- `src/LH.Licensing.Server.Infrastructure`
- `src/LH.Licensing.Server.Contracts`
- `tests/LH.Licensing.Server.Tests`

## Commands

```bash
dotnet build LH.Licensing.Server.sln
dotnet test LH.Licensing.Server.sln
```

## Health

- `GET /health`
- `GET /health/ready`

## Local startup

Use [docs/plans/2026-04-11-lh-licensing-server-local-startup.md](docs/plans/2026-04-11-lh-licensing-server-local-startup.md) for the full runbook.

Quick path:

```bash
docker compose up -d postgres

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

dotnet tool restore
dotnet tool run dotnet-ef database update --project src/LH.Licensing.Server.Infrastructure/LH.Licensing.Server.Infrastructure.csproj --startup-project src/LH.Licensing.Server.Api/LH.Licensing.Server.Api.csproj --context AppDbContext
dotnet run --project src/LH.Licensing.Server.Api/LH.Licensing.Server.Api.csproj
```

## Preprod deployment

Runbooks:

- [docs/plans/2026-04-11-lh-licensing-server-proxmox-vm-setup.md](docs/plans/2026-04-11-lh-licensing-server-proxmox-vm-setup.md)
- [docs/plans/2026-04-11-lh-licensing-server-preprod-deployment.md](docs/plans/2026-04-11-lh-licensing-server-preprod-deployment.md)
- [docs/plans/2026-04-11-lh-licensing-server-pfsense-haproxy-integration.md](docs/plans/2026-04-11-lh-licensing-server-pfsense-haproxy-integration.md)

Deploy assets:

- `deploy/compose/compose.preprod.yml`
- `deploy/compose/.env.example`
- `deploy/docker/Dockerfile.api`
- `deploy/scripts/*`
