# LH.Licensing.Server Proxmox VM Setup

This document defines a minimal but production-shaped single-node VM for staging/preprod.

## Recommendation

Use **Debian 12 Bookworm** for the VM.

Why:

- stable base
- low maintenance
- good fit for a dedicated single-purpose host
- Docker support is straightforward

If the team standardizes on Ubuntu LTS, Ubuntu 24.04 LTS is also acceptable. The operating model stays the same.

## VM sizing

Minimum:

- 2 vCPU
- 4 GB RAM
- 40 GB SSD

Recommended if the node also carries backups or heavier testing:

- 4 vCPU
- 8 GB RAM
- 60 GB SSD

For the current MVP, 2 vCPU / 4 GB is acceptable.

## Suggested hostname and network

- hostname: `lh-licensing-staging`
- IP: static or DHCP reservation
- DNS: internal staging hostname, later promotable to production DNS

Suggested naming pattern:

- internal host: `lh-licensing-staging.internal`
- public staging name through pfSense: `licensing.staging.example.com`

## Ports

Open only what is needed:

- `22/tcp` from the admin network for SSH
- `8080/tcp` from the pfSense / HAProxy source IP only

Do not expose PostgreSQL publicly.

## Base packages

Install:

- `ca-certificates`
- `curl`
- `gnupg`
- `ufw`
- `fail2ban`
- `openssl`
- Docker Engine
- Docker Compose plugin

## Directory layout

Use a dedicated base directory:

```text
/opt/lh-licensing/
  compose/
  secrets/
  data/
    postgres/
  backups/
  logs/
  repo/
```

Recommended usage:

- `compose/` stores the `.env` file and operational compose inputs
- `secrets/` stores PEM files and other sensitive material
- `data/postgres/` stores the PostgreSQL bind mount
- `backups/` stores dumps and restore points
- `logs/` is optional for exported operational artifacts
- `repo/` is the git checkout or deployment working copy

## Preparation steps

```bash
sudo mkdir -p /opt/lh-licensing/{compose,secrets,data/postgres,backups,logs,repo}
sudo chown -R root:root /opt/lh-licensing
sudo chmod 750 /opt/lh-licensing
sudo chmod 750 /opt/lh-licensing/{compose,secrets,data,backups,logs,repo}
sudo chmod 750 /opt/lh-licensing/data/postgres
```

For the PostgreSQL data directory, ensure the container user can write to it. On first boot, if needed:

```bash
sudo chown -R 999:999 /opt/lh-licensing/data/postgres
```

## Secrets preparation

Store secrets outside the repository:

- `/opt/lh-licensing/compose/.env`
- `/opt/lh-licensing/secrets/lh-licensing-private.pem`
- `/opt/lh-licensing/secrets/lh-licensing-public.pem`

Copy the sample env file from the repository:

```bash
cp /path/to/repo/deploy/compose/.env.example /opt/lh-licensing/compose/.env
```

Then populate:

- database password
- admin API key
- pfSense HAProxy source IP
- JWT issuer and any deployment-specific values

## Hardening basics

- use SSH keys only
- disable password login if possible
- keep the VM on a private management network
- restrict Docker host ports with firewall rules
- patch the host on a predictable cadence
- do not run other workloads on the same VM

