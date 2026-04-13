# LH.Licensing.Client.Sample Real-Mode Runbook

This runbook shows how to execute `LH.Licensing.Client.Sample` against a real `LH.Licensing.Server` instance, without demo simulation.

## Prerequisites

- .NET 8 SDK installed.
- A running PostgreSQL instance reachable by the licensing server.
- A fixed RSA key pair used by the server to sign JWTs.
- The matching public key available to the sample client.

## Step 1: Prepare RSA keys

Generate or reuse a fixed key pair:

```bash
openssl genrsa -out licensing-private.pem 2048
openssl rsa -in licensing-private.pem -pubout -out licensing-public.pem
```

The server uses the private key.
The sample uses the public key.

## Step 2: Start the licensing server

Run the backend with explicit configuration:

```bash
export DOTNET_ROOT=/Users/carlosgavela/.dotnet
export PATH="$DOTNET_ROOT:$PATH"

export ConnectionStrings__Database="Host=localhost;Port=5432;Database=lh_licensing_server;Username=postgres;Password=postgres"
export JWT_ISSUER="https://licensing.staging.loadinghappiness.local"
export Jwt__Issuer="$JWT_ISSUER"
export Jwt__Audience="lh-licensing-api"
export Jwt__PrivateKeyPemPath="/absolute/path/to/licensing-private.pem"
export Jwt__PublicKeyPemPath="/absolute/path/to/licensing-public.pem"
export Jwt__KeyId="lh-licensing-key-1"
export Admin__ApiKey="change-me"
export Admin__ActorId="bootstrap-admin"
export VM_PRIVATE_IP="192.168.27.3"

dotnet run --project src/LH.Licensing.Server.Api/LH.Licensing.Server.Api.csproj
```

Expected local endpoints:

- `http://192.168.27.3:8080` when the VM is reached directly
- `/health`
- `/health/ready`
- `/api/licenses/activate`
- `/api/licenses/refresh`

## Step 3: Run the sample client in real mode

Use the public key generated above:

```bash
export DOTNET_ROOT=/Users/carlosgavela/.dotnet
export PATH="$DOTNET_ROOT:$PATH"

dotnet run --project samples/LH.Licensing.Client.Sample/LH.Licensing.Client.Sample.csproj -- \
  --real=true \
  --baseUrl=http://192.168.27.3:8080 \
  --issuer="$JWT_ISSUER" \
  --publicKey=/absolute/path/to/licensing-public.pem \
  --stateFile=/tmp/lh-licensing-client-state.json
```

Recommended additional flags:

```bash
  --simulateTransient=false \
  --simulateRevocation=false \
  --simulateOfflineExpiry=false
```

## Expected client behavior

With valid server data, the sample should:

- activate on first run;
- persist the returned license snapshot locally;
- validate the JWT signature with the public key;
- refresh successfully when the refresh token is still valid;
- rotate the refresh token;
- block after revocation;
- degrade when refresh is temporarily unavailable and offline grace is still active.

## Scenario checklist

### 1. Activação válida

- Use a license key that exists on the server.
- The client should print `Allowed` after activation and local validation.

### 2. Activação inválida

- Use an unknown or incorrect license key.
- The server should reject activation.
- The client should not persist partial state.

### 3. Refresh válido

- Run refresh before the refresh token expires.
- The client should replace the cached refresh token and access token.

### 4. Refresh com token antigo após rotação

- Reuse the old refresh token manually.
- The server should reject it.

### 5. Refresh após revogação

- Revoke the license through `POST /api/admin/licenses/{id}/revoke`.
- The next refresh should fail definitively.

### 6. Arranque offline dentro da grace window

- Disconnect the network after a successful activation.
- The client may continue in degraded mode until `offlineGraceUntil`.

### 7. Arranque offline após `offlineGraceUntil`

- Start the app with an expired grace window and no network.
- The client should block.

### 8. `appId` / `installationId` mismatch

- Reuse the snapshot in a different app context or with a different fingerprint.
- The client validator should block or degrade depending on the cached token age and grace window.

## Notes about this repository snapshot

This worktree does not currently include a local PostgreSQL server or container runtime, so the real-mode run could not be executed on this machine.
The sample and the runbook are ready, but the final live validation requires a reachable PostgreSQL-backed server process.
