import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { config } from "../config.js";
import { signLicenseToken, verifyLicenseToken, getJwks as getJwksInternal } from "./jwt.js";
import { License, LicenseEventType, LicenseStatus } from "@prisma/client";

const REBIND_LIMIT_PER_MONTH = 2;

function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function graceExpired(expiresAt: Date) {
  const graceUntil = new Date(expiresAt.getTime());
  graceUntil.setUTCDate(graceUntil.getUTCDate() + config.LICENSE_GRACE_DAYS);
  return new Date() > graceUntil;
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
      data: { hardwareHash, rebindCount, rebindPeriod }
    });
  }

  if (license.hardwareHash === hardwareHash) {
    if (license.rebindPeriod !== rebindPeriod || license.rebindCount !== rebindCount) {
      return prisma.license.update({
        where: { id: license.id },
        data: { rebindCount, rebindPeriod }
      });
    }
    return license;
  }

  if (rebindCount >= REBIND_LIMIT_PER_MONTH) {
    await prisma.licenseEvent.create({
      data: {
        licenseId: license.id,
        type: LicenseEventType.REBIND_DENIED,
        hardwareHash
      }
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
    }
  });

  await prisma.licenseEvent.create({
    data: {
      licenseId: license.id,
      type: LicenseEventType.REBIND,
      hardwareHash
    }
  });

  return updated;
}

async function logEvent(licenseId: string, type: LicenseEventType, data: { ip?: string; userAgent?: string; hardwareHash?: string }) {
  await prisma.licenseEvent.create({
    data: {
      licenseId,
      type,
      hardwareHash: data.hardwareHash,
      ip: data.ip,
      userAgent: data.userAgent
    }
  });
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
    include: { license: { include: { customer: true } } }
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

  let bound: License;
  try {
    bound = await ensureHardwareBinding(license, input.hardwareHash);
  } catch (err: any) {
    return { ok: false, error: err.message || "Hardware rebind not allowed" } as const;
  }

  await prisma.activationToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() }
  });

  await logEvent(bound.id, LicenseEventType.ACTIVATE, {
    ip: input.ip,
    userAgent: input.userAgent,
    hardwareHash: input.hardwareHash
  });

  const jwt = await signLicenseToken(bound, {
    company: token.license.customer?.name || "",
    plan: bound.planName,
    max_companies: bound.maxCompanies,
    max_workstations: bound.maxWorkstations,
    hw: input.hardwareHash
  });

  return { ok: true, licenseToken: jwt } as const;
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
      include: { customer: true }
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

    let bound: License;
    try {
      bound = await ensureHardwareBinding(license, input.hardwareHash);
    } catch (err: any) {
      return { ok: false, error: err.message || "Hardware rebind not allowed" } as const;
    }

    await logEvent(bound.id, LicenseEventType.REFRESH, {
      ip: input.ip,
      userAgent: input.userAgent,
      hardwareHash: input.hardwareHash
    });

    const jwt = await signLicenseToken(bound, {
      company: license.customer?.name || "",
      plan: bound.planName,
      max_companies: bound.maxCompanies,
      max_workstations: bound.maxWorkstations,
      hw: input.hardwareHash
    });

    return { ok: true, licenseToken: jwt } as const;
  } catch (err: any) {
    return { ok: false, error: err.message || "Invalid license token" } as const;
  }
}

export async function listLicenses() {
  return prisma.license.findMany({
    include: { customer: true },
    orderBy: { createdAt: "desc" }
  });
}

export async function getLicense(id: string) {
  return prisma.license.findUnique({
    where: { id },
    include: { customer: true, activationTokens: true }
  });
}

export async function createLicense(input: {
  customerName: string;
  customerEmail?: string;
  planName: string;
  maxCompanies: number;
  maxWorkstations: number;
  expiresAt?: string;
}) {
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const customer = await prisma.customer.create({
    data: {
      name: input.customerName,
      email: input.customerEmail || null
    }
  });

  const license = await prisma.license.create({
    data: {
      customerId: customer.id,
      planName: input.planName,
      maxCompanies: input.maxCompanies,
      maxWorkstations: input.maxWorkstations,
      expiresAt
    },
    include: { customer: true }
  });

  await prisma.licenseEvent.create({
    data: {
      licenseId: license.id,
      type: LicenseEventType.ADMIN_UPDATE
    }
  });

  return license;
}

export async function updateLicense(id: string, input: {
  planName?: string;
  maxCompanies?: number;
  maxWorkstations?: number;
  status?: LicenseStatus;
  expiresAt?: string;
}) {
  const data: any = {};
  if (input.planName) data.planName = input.planName;
  if (typeof input.maxCompanies === "number") data.maxCompanies = input.maxCompanies;
  if (typeof input.maxWorkstations === "number") data.maxWorkstations = input.maxWorkstations;
  if (input.status) data.status = input.status;
  if (input.expiresAt) data.expiresAt = new Date(input.expiresAt);

  const license = await prisma.license.update({
    where: { id },
    data,
    include: { customer: true }
  }).catch(() => null);

  if (license) {
    await prisma.licenseEvent.create({
      data: {
        licenseId: license.id,
        type: LicenseEventType.ADMIN_UPDATE
      }
    });
  }

  return license;
}

export async function revokeLicense(id: string) {
  return updateLicense(id, { status: LicenseStatus.REVOKED });
}

export async function createActivationLink(id: string) {
  const license = await prisma.license.findUnique({ where: { id } });
  if (!license) return null;

  const token = randomBytes(24).toString("hex");
  await prisma.activationToken.create({
    data: {
      licenseId: id,
      token
    }
  });

  return `${config.BASE_URL}/activate/${token}`;
}
