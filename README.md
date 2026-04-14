# LH Licensing Server

Monorepo for the licensing backend (Fastify + Prisma) and internal admin web UI (Next.js).

## Apps
- `apps/api`: Public licensing API and admin API
- `apps/web`: Internal admin web UI (Entra ID login)

## Quick start

1. Copy env examples:
- `apps/api/.env.example` -> `apps/api/.env`
- `apps/web/.env.example` -> `apps/web/.env`

2. Install deps:
```
npm install
```

3. Run database migrations:
```
cd apps/api
npm run prisma:migrate
```

4. Start dev servers:
```
npm run dev:api
npm run dev:web
```

## Local URLs
- UI: http://localhost:3000
- API: http://localhost:3001/api/v1

## Notes
- Admin auth uses Entra ID (Azure AD). Configure tenant/client in env.
- If Entra is not configured, the admin surface is disabled.
- The internal UI is read/write for customers, products, plans, and licenses; installations and audit events are read-only.

## Keys

Generate RSA keys for signing tokens:
```
cd apps/api
npm run keys:generate
```

Set `SIGNING_KEY_PRIVATE_PEM_PATH` to the generated `private.pem`.

## Admin UI

Open `/dashboard` after signing in with an Entra account in the admin group.
Seeded local data includes:
- product `ETIQUETAS_GS1`
- plan `BASIC_LOCAL`
- demo customer `Loading Happiness Internal`
- demo license `LH-GS1-LOCAL-0001`

### Admin auth assumptions

- Admin access is fail-closed unless `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, and `ENTRA_ADMIN_GROUP_ID` are configured.
- The web app expects the Entra `id_token` to contain either a `groups` claim or a `roles` claim.
- The configured `ENTRA_ADMIN_GROUP_ID` value must appear in one of those claims.
- If the claim is missing, the admin UI and admin API deny access.
