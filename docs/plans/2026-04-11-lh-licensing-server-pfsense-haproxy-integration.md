# LH.Licensing.Server pfSense + HAProxy Integration

This document describes the external reverse proxy / TLS termination setup for the preprod node.

## Topology

```text
Internet or internal clients
  -> pfSense HAProxy
  -> HTTP backend on the VM
  -> LH.Licensing.Server API
  -> PostgreSQL on the private Docker network
```

TLS terminates on pfSense.
The VM receives plain HTTP only.

## Backend target

Configure the HAProxy backend to point at:

- the VM private IP, for example `192.168.27.3`
- port `8080`
- protocol `http`

Use the staging hostname as the public-facing frontend host, for example:

- `licensing.staging.example.com`

## Headers to forward

Forward the original request context:

- `Host`
- `X-Forwarded-For`
- `X-Forwarded-Proto`
- `X-Forwarded-Host`

`X-Forwarded-Proto` should be `https` at the public edge.

Optionally also forward:

- `X-Forwarded-Port: 443`

## Health checks

Use the API readiness endpoint for HAProxy health checks:

- `GET /health/ready`

Expected response:

- `200 OK` when PostgreSQL is reachable and the API is ready

This is the best signal for routing traffic.

## Firewall notes

On the VM firewall:

- allow `8080/tcp` only from the pfSense / HAProxy source IP
- allow `22/tcp` only from the admin network
- keep `5432/tcp` closed to the network

Do not rely only on the reverse proxy for security.
The host firewall must still block unwanted sources.

## Trusted proxy configuration

The API now supports forwarded headers, but it only trusts the proxy IPs configured in `Proxy__KnownProxies`.

Set:

- `Proxy__KnownProxies__0=<pfSense HAProxy source IP>`

The VM private IP can be documented alongside the deployment env example as `VM_PRIVATE_IP=192.168.27.3`, but HAProxy should still target the VM's actual private address on port `8080`.

This prevents arbitrary clients from spoofing forwarded headers.

## Operational notes

- the VM is plain HTTP internally
- there is no TLS configuration inside the VM
- if the HAProxy source IP changes, update `Proxy__KnownProxies`
- if the staging hostname changes, update `Jwt__Issuer` only if the sample/client validation expects that issuer
