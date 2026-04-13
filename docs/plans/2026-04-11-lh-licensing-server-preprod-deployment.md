# LH.Licensing.Server Preprod Deployment

This runbook describes the single-node staging/preprod deployment on a dedicated Proxmox VM.

## Scope

- Docker Compose on one VM
- API container
- PostgreSQL container
- secrets mounted from files outside the repo
- reverse proxy and TLS handled by pfSense HAProxy

## File layout in the repository

```text
deploy/
  compose/
    compose.preprod.yml
    .env.example
  docker/
    Dockerfile.api
  scripts/
    up.sh
    run-migrations.sh
    backup-postgres.sh
    restore-postgres.sh
```

## Host layout on the VM

```text
/opt/lh-licensing/
  compose/.env
  secrets/lh-licensing-private.pem
  secrets/lh-licensing-public.pem
  data/postgres/
  backups/
  logs/
  repo/
```

The repository checkout lives in `/opt/lh-licensing/repo`.
Secrets and data live outside the repository checkout.
The example VM private IP used in runbooks and smoke tests is `192.168.27.3`, exported as `VM_PRIVATE_IP` in `/opt/lh-licensing/compose/.env`.

## Bring-up order

1. Prepare the VM and directories.
2. Put secrets in `/opt/lh-licensing/secrets`.
3. Copy `.env.example` to `/opt/lh-licensing/compose/.env` and fill the values.
4. Run migrations explicitly.
5. Start the stack.
6. Put pfSense HAProxy in front of the VM.

## Start the stack

From the repository checkout on the VM:

```bash
./deploy/scripts/up.sh
```

This builds the API image and starts:

- `postgres`
- `lh-licensing-api`

## Run migrations

Run migrations explicitly before the first rollout and after schema changes:

```bash
./deploy/scripts/run-migrations.sh
```

This uses the SDK container to execute `dotnet ef database update` against the Compose network.

## Update

Recommended update flow:

1. pull the new commit or tag in the repo checkout
2. review the migration diff
3. run `./deploy/scripts/run-migrations.sh` if schema changed
4. run `./deploy/scripts/up.sh`

The deployment is intentionally simple and reproducible.

## Rollback

Application rollback:

- checkout the previous commit or tag
- rerun `./deploy/scripts/up.sh`

Database rollback:

- restore from backup if the schema change is not safely reversible

Do not assume schema rollback is always possible.

## Health checks

Operational checks:

- `GET /health`
- `GET /health/ready`

If the API is behind pfSense:

- test the HAProxy frontend URL
- confirm the backend still reports ready

## Backup

Create a compressed PostgreSQL dump:

```bash
./deploy/scripts/backup-postgres.sh
```

Backups are stored in `/opt/lh-licensing/backups`.

## Restore

Restore from a compressed dump:

```bash
./deploy/scripts/restore-postgres.sh /opt/lh-licensing/backups/<backup>.sql.gz
```

## Troubleshooting

- If the API fails to start, check the connection string and JWT key paths.
- If `/health/ready` fails, check PostgreSQL connectivity.
- If the sample client fails JWT validation, confirm `Jwt__Issuer`, `Jwt__Audience`, and the RSA key pair.
- If forwarded headers are ignored, check `Proxy__KnownProxies`.
- If PostgreSQL is unreachable, confirm the VM firewall and Docker network.

## Sample client smoke test

For a real-mode smoke test against this preprod stack, pass the issuer configured in `/opt/lh-licensing/compose/.env` to the client sample:

```bash
--issuer="$JWT_ISSUER"
```
