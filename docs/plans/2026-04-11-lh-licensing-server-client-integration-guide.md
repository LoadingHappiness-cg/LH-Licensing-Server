# LH.Licensing.Server Client Integration Guide

Version: `1.0`
Audience: desktop apps consuming the Loading Happiness licensing platform

This guide turns the public contract into a practical client flow for a real desktop application.
It is intentionally implementation-oriented and assumes the client owns:

- secure local storage of the latest license material;
- JWT signature validation with the public key;
- offline enforcement and UX decisions;
- retry policy for refresh.

The server remains the source of truth for activation, refresh, and revocation.

## Recommended client state

Store only the minimum required local material:

- `accessToken` JWT
- `refreshToken` opaque token
- `expiresAt`
- `offlineGraceUntil`
- `policyVersion`
- `productCode`
- `appId`
- `installationId`
- `lastValidatedAt`
- `licenseId`

Do not store the license key after activation unless the product explicitly needs it for support workflows.
Do not store JWT claims as authoritative data without validating the signature.

Recommended secure storage:

- Windows desktop: DPAPI or Credential Manager
- macOS desktop: Keychain
- Cross-platform fallback: encrypted local file with OS-specific key material

The storage mechanism can vary by product, but the persisted shape should stay the same.

## Integration sequence

### 1. Bootstrap

1. App starts and loads the last saved license snapshot.
2. App validates the cached JWT locally.
3. App decides one of three states:
   - `allowed`: normal use;
   - `degraded`: offline grace is active but refresh is needed;
   - `blocked`: license is invalid or grace expired.
4. If the token is close to expiry or the app is online, attempt refresh.

### 2. First activation

When the user enters a license key:

1. Collect `licenseKey`, `productCode`, `appId`, `machineFingerprint`, `deviceName`, `clientVersion`.
2. Call `POST /api/licenses/activate`.
3. On success:
   - validate the returned JWT signature;
   - persist the returned snapshot securely;
   - use the token for local license decisions.
4. On failure:
   - surface the error message mapped to the `errorCode`;
   - do not persist partial state.

### 3. Refresh

The app should refresh:

- on startup if online and the token is near expiry;
- before `exp`;
- when the app regains connectivity after being offline;
- after a policy version change, if the server indicates one.

Refresh should be treated as a rotate-and-replace operation:

1. Send the current `refreshToken`.
2. If refresh succeeds, overwrite both `accessToken` and `refreshToken`.
3. If refresh fails with a definitive error, stop trusting the cached token.
4. If refresh fails with a transient error, keep the cached token until the next retry or until `offlineGraceUntil`.

## Local validation flow

Before trusting a cached token, validate:

1. Signature using the public key.
2. `iss` matches the configured issuer.
3. `aud` matches `lh-licensing-api` or the product-specific configured audience.
4. `exp` is in the future, allowing configured clock skew.
5. `nbf` is not in the future beyond configured clock skew.
6. `product_code` matches the current app.
7. `app_id` matches the current app identity.
8. `installation_id` matches the local installation record.
9. `policy_version` is supported by the client.
10. `license_status` is usable.

If any of the first six checks fails, treat it as a hard failure.
If `exp` fails but the app is still before `offlineGraceUntil`, the app may continue in degraded mode only if the product allows offline use.

## State model

Use a simple three-state model:

- `Allowed`: license valid, token valid, normal features enabled.
- `Degraded`: token expired or refresh unavailable, but still inside `offlineGraceUntil`.
- `Blocked`: no valid token or offline grace expired, or revocation/invalidation detected.

Suggested UX rules:

- `Allowed`: full app functionality.
- `Degraded`: allow read-only or limited operations, depending on the product.
- `Blocked`: stop core licensed workflows and require activation/refresh.

## Refresh outcomes

### Successful refresh

- Replace cached token and refresh token immediately.
- Update `expiresAt`, `offlineGraceUntil`, and `policyVersion`.
- Re-run local JWT validation on the new access token.

### Refresh fails with transient error

Examples:

- network unreachable;
- DNS failure;
- timeout;
- gateway error;
- service unavailable.

Behavior:

- keep the existing cached token if still within `exp` or `offlineGraceUntil`;
- schedule retry with backoff;
- do not clear the cached state.

### Refresh fails with definitive error

Examples:

- `activation_revoked`
- `license_inactive`
- `product_mismatch`
- `app_mismatch`
- `fingerprint_mismatch`
- `refresh_token_not_found`
- `refresh_token_expired`

Behavior:

- stop trusting the cached license material;
- block or degrade immediately according to product policy;
- require a new activation or support intervention.

## What to do on app startup

Recommended startup logic:

```csharp
var snapshot = await store.LoadAsync();

if (snapshot is null)
{
    return LicenseDecision.Blocked("No local license state.");
}

var validation = validator.Validate(snapshot.AccessToken, expectedContext);

if (!validation.IsValid)
{
    if (snapshot.OfflineGraceUntil > now)
    {
        return LicenseDecision.Degraded("JWT invalid, but offline grace still available.");
    }

    return LicenseDecision.Blocked(validation.Reason);
}

if (now > snapshot.ExpiresAt)
{
    if (now <= snapshot.OfflineGraceUntil)
    {
        return LicenseDecision.Degraded("Token expired, still within offline grace.");
    }

    return LicenseDecision.Blocked("License expired.");
}

return LicenseDecision.Allowed();
```

## Suggested C# flow

### Activation

```csharp
public async Task<LicenseDecision> ActivateAsync(string licenseKey, string productCode, string appId)
{
    var request = new
    {
        licenseKey,
        productCode,
        appId,
        machineFingerprint = fingerprintProvider.GetFingerprint(),
        deviceName = environment.DeviceName,
        clientVersion = appVersion
    };

    var response = await http.PostAsJsonAsync("/api/licenses/activate", request);
    if (!response.IsSuccessStatusCode)
    {
        return LicenseDecision.Blocked(await ReadErrorAsync(response));
    }

    var payload = await response.Content.ReadFromJsonAsync<ActivateLicenseResponseDto>();
    if (payload is null)
    {
        return LicenseDecision.Blocked("Empty activation response.");
    }

    validator.Validate(payload.AccessToken, expectedContext);
    await store.SaveAsync(payload);
    return LicenseDecision.Allowed();
}
```

### Refresh

```csharp
public async Task<LicenseDecision> RefreshAsync()
{
    var snapshot = await store.LoadAsync();
    if (snapshot is null)
    {
        return LicenseDecision.Blocked("Missing cached license state.");
    }

    var request = new
    {
        refreshToken = snapshot.RefreshToken,
        productCode = snapshot.ProductCode,
        appId = snapshot.AppId,
        machineFingerprint = fingerprintProvider.GetFingerprint(),
        clientVersion = appVersion
    };

    var response = await http.PostAsJsonAsync("/api/licenses/refresh", request);

    if (response.IsSuccessStatusCode)
    {
        var payload = await response.Content.ReadFromJsonAsync<RefreshLicenseResponseDto>();
        validator.Validate(payload!.AccessToken, expectedContext);
        await store.SaveAsync(payload);
        return LicenseDecision.Allowed();
    }

    var errorCode = await ReadErrorCodeAsync(response);
    if (IsTransient(response.StatusCode))
    {
        return now <= snapshot.OfflineGraceUntil
            ? LicenseDecision.Degraded("Refresh temporarily unavailable.")
            : LicenseDecision.Blocked("Refresh unavailable and grace expired.");
    }

    await store.ClearAsync();
    return LicenseDecision.Blocked(errorCode);
}
```

## Validation helpers

Use the following validation rules locally:

- `iss`: exact string match.
- `aud`: exact string match.
- `exp`: reject if `now > exp + clockSkew`.
- `nbf`: reject if `now + clockSkew < nbf`.
- `product_code`: exact match with the current product identifier.
- `app_id`: exact match with the current app identifier.
- `installation_id`: exact match with the persisted installation identifier.
- `policy_version`: reject if higher than the client can interpret, or if lower than the minimum supported version.

The client should not attempt to infer business rules from the token beyond these checks and the entitlement snapshot.

## When to refresh

Recommended refresh triggers:

- startup;
- before `exp` if online;
- after reconnecting from offline mode;
- after user returns to the app following a long idle period;
- when the app detects that `offlineGraceUntil` is approaching.

Recommended timing:

- refresh when less than 25 percent of the token lifetime remains, or at a fixed pre-expiry window such as 10 to 15 minutes for short-lived tokens;
- if the app is offline, defer and keep the local snapshot until the next connectivity event.

## How to treat `offlineGraceUntil`

`offlineGraceUntil` is the hard limit for continuing without the server.

- Before `offlineGraceUntil`: degraded mode is allowed if the token is expired but otherwise valid.
- After `offlineGraceUntil`: the app should block licensed functionality.
- If the server has revoked the license, the app should stop trusting the token on the next successful online check, even if the offline grace window has not yet elapsed.

## Errors: transient vs definitive

### Transient

- network timeouts;
- DNS failures;
- connection refused;
- `502`, `503`, `504`;
- temporary TLS or proxy issues.

Keep the cached license state and retry later.

### Definitive

- invalid or expired refresh token;
- revocation;
- product mismatch;
- app mismatch;
- fingerprint mismatch;
- inactive license;
- unsupported policy version.

Clear or quarantine the local snapshot and require user action.

## Gaps to keep in mind

The backend contract is enough for a real client integration, but the client must still define:

- secure persistence implementation per OS;
- exact degraded-mode UX;
- retry policy and backoff;
- the local installation fingerprint algorithm;
- the minimum supported policy version.

Those are client decisions, not backend changes.
