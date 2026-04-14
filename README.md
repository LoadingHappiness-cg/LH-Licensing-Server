# LH Licensing Server

Monorepo for the licensing backend (Fastify + Prisma) and internal admin web UI (Next.js).

## Apps
- `apps/api`: Public licensing API and admin API
- `apps/web`: Internal admin web UI (Entra ID login)

## Quick start

1. Copy env examples to the runtime files:
   - `apps/api/.env.example` -> `apps/api/.env`
   - `apps/web/.env.example` -> `apps/web/.env`

2. Install deps:
   - `npm ci`

3. Generate Prisma client:
   - `npm run prisma:generate -w @lh-licensing/api`

4. Run database migrations:
   - `cd apps/api && npm run prisma:migrate`

5. Build:
   - `npm run build`

6. Start the API and web app:
   - `npm run dev:api`
   - `npm run dev:web`

## Local URLs
- UI: http://localhost:3000
- API: http://localhost:3001/api/v1

## Notes
- Admin auth uses a local username/password pair configured in env.
- The internal UI is read/write for customers, products, plans, and licenses; installations and audit events are read-only.

## Required env vars

`apps/api`
- Required:
  - `DATABASE_URL`
  - `SIGNING_KEY_PRIVATE_PEM` or `SIGNING_KEY_PRIVATE_PEM_PATH`
  - `ADMIN_API_TOKEN`
- Optional but recommended:
  - `JWT_ISSUER`
  - `JWT_AUDIENCE`
  - `BASE_URL` should be set to the public licensing server URL in preprod/prod
  - `PORT`
  - `API_PREFIX`

`apps/web`
- Required:
  - `SITE_URL` for the external web origin, for example `http://192.168.27.3:3000`
  - `API_BASE_URL`
  - `NEXTAUTH_SECRET`
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD_HASH`
  - `ADMIN_API_TOKEN`
- Optional:
  - `ADMIN_DISPLAY_NAME`

## Keys

Generate RSA keys for signing tokens:
```
cd apps/api
npm run keys:generate
```

Set `SIGNING_KEY_PRIVATE_PEM_PATH` to the generated `private.pem`.

## Admin UI

Open `/login` and sign in with the local admin credentials from `apps/web/.env`.
Seeded local data includes:
- product `ETIQUETAS_GS1`
- plan `BASIC_LOCAL`
- demo customer `Loading Happiness Internal`
- demo license `LH-GS1-LOCAL-0001`

### Admin auth assumptions

- Admin access is fail-closed unless `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `ADMIN_API_TOKEN` are configured.
- The password hash must be a bcrypt hash generated outside the app.
- The web app marks the session as admin only after a successful username/password check.
- The web app sends the shared `ADMIN_API_TOKEN` to the API when it calls admin routes.
- If the session is missing or the shared admin token is missing or invalid, the admin UI and admin API deny access.

## VM / preprod startup

Required:
- Node 22.x
- MySQL 8 or MariaDB 10.11+
- A valid RSA signing key for the API
- A local admin username/password hash and shared admin API token

Place the runtime env files here:
- `apps/api/.env`
- `apps/web/.env`

Startup order:
```
npm ci
npm run prisma:generate -w @lh-licensing/api
cd apps/api
npm run prisma:migrate
cd ../..
npm run build
npm run dev:api
npm run dev:web
```

For a VM at `192.168.27.3`, set:
- `SITE_URL=http://192.168.27.3:3000`
- `API_BASE_URL=http://192.168.27.3:3001/api/v1`
- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD_HASH=<bcrypt hash generated outside the app>`
- `ADMIN_API_TOKEN=<long random shared secret>`
- `ADMIN_DISPLAY_NAME=Loading Happiness Admin` if you want a friendly label
