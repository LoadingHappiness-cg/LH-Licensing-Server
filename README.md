# LH Licensing Server

Monorepo for the licensing backend (Fastify + MariaDB) and admin web UI (Next.js).

## Apps
- `apps/api`: Public licensing API and admin API
- `apps/web`: Admin web UI (Entra ID login)

## Quick start

1. Copy env examples:
- `apps/api/.env.example` -> `apps/api/.env`
- `apps/web/.env.example` -> `apps/web/.env`

2. Install deps:
```
npm install
```

3. Run database migrations (MariaDB):
```
cd apps/api
npm run prisma:migrate
```

4. Start dev servers:
```
npm run dev:api
npm run dev:web
```

## Domains
- UI: https://license.loadinghappiness.pt
- API: https://license.loadinghappiness.pt/api/v1

## Notes
- Admin auth uses Entra ID (Azure AD). Configure tenant/client in env.
- If Entra is not configured, admin endpoints can be protected with `ADMIN_API_KEY`.

## Keys

Generate RSA keys for signing tokens:
```
cd apps/api
npm run keys:generate
```

Set `SIGNING_KEY_PRIVATE_PEM_PATH` to the generated `private.pem`.
