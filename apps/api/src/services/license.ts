import { randomBytes } from "node:crypto";
import { AuditEventType, InstallationStatus, License, LicenseStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { config } from "../config.js";
import { signLicenseToken, verifyLicenseToken, getJwks as getJwksInternal } from "./jwt.js";

const REBIND_LIMIT_PER_MONTH = 2;

function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function graceExpired(expiresAt: Date) {
  const graceUntil = new Date(expiresAt.getTime());
  graceUntil.setUTCDate(graceUntil.getUTCDate() + config.LICENSE_GRACE_DAYS);
  return new Date() > graceUntil;
}

async function createAuditEvent(data: Record<string, unknown>) {
  await prisma.auditEvent.create({ data: data as any });
}

async function ensureHardwareBinding(license: License, hardwareHash: string) {
  const currentMonth = monthKey();
  let rebindCount = license.rebindCount;
  let rebindPeriod = license.rebindPeriod || "";

  if (rebindPeriod !== currentMonth) {
    rebindPeriod = currentMonth;
    rebindCount = 0;
  }

  if (!license.hardwareHash) {
    return prisma.license.update({
      where: { id: license.id },
      data: { hardwareHash, rebindCount, rebindPeriod },
      include: { customer: true, product: true, plan: true }
    });
  }

  if (license.hardwareHash === hardwareHash) {
    if (license.rebindPeriod !== rebindPeriod || license.rebindCount !== rebindCount) {
      return prisma.license.update({
        where: { id: license.id },
        data: { rebindCount, rebindPeriod },
        include: { customer: true, product: true, plan: true }
      });
    }
    return license;
  }

  if (rebindCount >= REBIND_LIMIT_PER_MONTH) {
    await createAuditEvent({
      eventType: AuditEventType.REBIND_DENIED,
      licenseId: license.id,
      payload: { hardwareHash }
    });
    throw new Error("Hardware rebind limit reached");
  }

  rebindCount += 1;
  const updated = await prisma.license.update({
    where: { id: license.id },
    data: {
      hardwareHash,
      rebindCount,
      rebindPeriod
    },
    include: { customer: true, product: true, plan: true }
  });

  await createAuditEvent({
    eventType: AuditEventType.REBIND,
    licenseId: license.id,
    payload: { hardwareHash }
  });

  return updated;
}

async function getOrCreateInstallation(input: {
  license: License;
  appId: string;
  hardwareHash: string;
  appVersion: string;
}) {
  const existing = await prisma.installation.findUnique({
    where: {
      appId_machineFingerprintHash: {
        appId: input.appId,
        machineFingerprintHash: input.hardwareHash
      }
    }
  });

  if (existing) {
    if (existing.status !== InstallationStatus.ACTIVE) {
      throw new Error("Installation blocked");
    }

    if (existing.licenseId && existing.licenseId !== input.license.id) {
      throw new Error("Installation bound to different license");
    }

    return prisma.installation.update({
      where: { id: existing.id },
      data: {
        licenseId: input.license.id,
        productId: input.license.productId,
        lastSeenAt: new Date(),
        status: InstallationStatus.ACTIVE,
        osInfo: input.appVersion || existing.osInfo
      }
    });
  }

  return prisma.installation.create({
    data: {
      licenseId: input.license.id,
      productId: input.license.productId,
      appId: input.appId,
      machineFingerprintHash: input.hardwareHash,
      deviceName: "",
      osInfo: input.appVersion || "",
      status: InstallationStatus.ACTIVE,
      firstSeenAt: new Date(),
      lastSeenAt: new Date()
    }
  });
}

async function requireActiveInstallation(appId: string, hardwareHash: string) {
  const existing = await prisma.installation.findUnique({
    where: {
      appId_machineFingerprintHash: {
        appId,
        machineFingerprintHash: hardwareHash
      }
    }
  });

  if (existing && existing.status !== InstallationStatus.ACTIVE) {
    throw new Error("Installation blocked");
  }

  return existing;
}

function ensureInstallationAssignment(installation: { id: string; licenseId: string | null }, licenseId: string) {
  if (installation.licenseId && installation.licenseId !== licenseId) {
    throw new Error("Installation bound to different license");
  }
}

async function getOrCreateActivation(input: {
  license: License;
  installationId: string;
  appVersion: string;
}) {
  const existing = await prisma.activation.findFirst({
    where: {
      licenseId: input.license.id,
      installationId: input.installationId,
      revokedAt: null
    },
    orderBy: { activatedAt: "desc" }
  });

  if (existing) {
    return prisma.activation.update({
      where: { id: existing.id },
      data: {
        lastRefreshedAt: new Date(),
        clientVersion: input.appVersion || existing.clientVersion,
        expiresAt: input.license.expiresAt
      }
    });
  }

  return prisma.activation.create({
    data: {
      licenseId: input.license.id,
      installationId: input.installationId,
      clientVersion: input.appVersion,
      activatedAt: new Date(),
      expiresAt: input.license.expiresAt
    }
  });
}

function licenseLimits(license: any) {
  return {
    plan: license.plan?.name || "",
    maxCompanies: license.plan?.maxCompanies ?? 1,
    maxWorkstations: license.plan?.maxWorkstations ?? 1
  };
}

export async function getJwks() {
  return getJwksInternal();
}

export async function activateLicense(input: {
  activationToken: string;
  hardwareHash: string;
  appId: string;
  appVersion: string;
  ip?: string;
  userAgent?: string;
}) {
  const token = await prisma.activationToken.findUnique({
    where: { token: input.activationToken },
    include: { license: { include: { customer: true, product: true, plan: true } } }
  });

  if (!token) {
    return { ok: false, error: "Invalid activation token" } as const;
  }

  if (token.expiresAt && token.expiresAt < new Date()) {
    return { ok: false, error: "Activation token expired" } as const;
  }

  const license = token.license;
  if (license.status !== LicenseStatus.ACTIVE) {
    return { ok: false, error: "License not active" } as const;
  }

  if (graceExpired(license.expiresAt)) {
    return { ok: false, error: "License expired" } as const;
  }

  try {
    await requireActiveInstallation(input.appId, input.hardwareHash);
  } catch (err: any) {
    return { ok: false, error: err.message || "Installation blocked" } as const;
  }

  let bound: any;
  try {
    bound = await ensureHardwareBinding(license, input.hardwareHash);
  } catch (err: any) {
    return { ok: false, error: err.message || "Hardware rebind not allowed" } as const;
  }

  try {
    const installation = await getOrCreateInstallation({
      license: bound,
      appId: input.appId,
      hardwareHash: input.hardwareHash,
      appVersion: input.appVersion
    });

    await getOrCreateActivation({
      license: bound,
      installationId: installation.id,
      appVersion: input.appVersion
    });

    await createAuditEvent({
      eventType: AuditEventType.ACTIVATE,
      licenseId: bound.id,
      productId: bound.productId,
      customerId: bound.customerId || undefined,
      installationId: installation.id,
      payload: {
        appId: input.appId,
        appVersion: input.appVersion,
        hardwareHash: input.hardwareHash
      },
      ip: input.ip,
      userAgent: input.userAgent
    });

    await prisma.activationToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() }
    });

    const jwt = await signLicenseToken(bound, {
      company: token.license.customer?.name || "",
      plan: licenseLimits(bound).plan,
      max_companies: licenseLimits(bound).maxCompanies,
      max_workstations: licenseLimits(bound).maxWorkstations,
      hw: input.hardwareHash,
      product: bound.product.code
    });

    return { ok: true, licenseToken: jwt } as const;
  } catch (err: any) {
    return { ok: false, error: err.message || "Unable to activate license" } as const;
  }
}

export async function refreshLicense(input: {
  licenseToken: string;
  hardwareHash: string;
  appId: string;
  appVersion: string;
  ip?: string;
  userAgent?: string;
}) {
  try {
    const { payload } = await verifyLicenseToken(input.licenseToken);
    const licenseId = String(payload.jti || "");
    if (!licenseId) {
      return { ok: false, error: "Invalid license token" } as const;
    }

    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      include: { customer: true, product: true, plan: true }
    });

    if (!license) {
      return { ok: false, error: "License not found" } as const;
    }

    if (license.status !== LicenseStatus.ACTIVE) {
      return { ok: false, error: "License not active" } as const;
    }

    if (graceExpired(license.expiresAt)) {
      return { ok: false, error: "License expired" } as const;
    }

    const installation = await requireActiveInstallation(input.appId, input.hardwareHash);
    if (!installation) {
      return { ok: false, error: "Installation not found" } as const;
    }

    let bound: any;
    try {
      bound = await ensureHardwareBinding(license, input.hardwareHash);
    } catch (err: any) {
      return { ok: false, error: err.message || "Hardware rebind not allowed" } as const;
    }

    try {
      ensureInstallationAssignment(installation, bound.id);
    } catch (err: any) {
      return { ok: false, error: err.message || "Installation bound to different license" } as const;
    }

    await prisma.installation.update({
      where: { id: installation.id },
      data: {
        licenseId: bound.id,
        lastSeenAt: new Date(),
        status: InstallationStatus.ACTIVE,
        osInfo: input.appVersion || installation.osInfo
      }
    });

    await prisma.activation.updateMany({
      where: { licenseId: bound.id, installationId: installation.id, revokedAt: null },
      data: {
        lastRefreshedAt: new Date(),
        expiresAt: bound.expiresAt
      }
    });

    await createAuditEvent({
      eventType: AuditEventType.REFRESH,
      licenseId: bound.id,
      productId: bound.productId,
      customerId: bound.customerId || undefined,
      installationId: installation.id,
      payload: {
        appId: input.appId,
        appVersion: input.appVersion,
        hardwareHash: input.hardwareHash
      },
      ip: input.ip,
      userAgent: input.userAgent
    });

    const jwt = await signLicenseToken(bound, {
      company: license.customer?.name || "",
      plan: licenseLimits(bound).plan,
      max_companies: licenseLimits(bound).maxCompanies,
      max_workstations: licenseLimits(bound).maxWorkstations,
      hw: input.hardwareHash,
      product: bound.product.code
    });

    return { ok: true, licenseToken: jwt } as const;
  } catch (err: any) {
    return { ok: false, error: err.message || "Invalid license token" } as const;
  }
}
