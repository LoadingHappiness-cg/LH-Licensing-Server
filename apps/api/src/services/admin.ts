import { randomBytes } from "node:crypto";
import { Prisma, AuditEventType, InstallationStatus, LicenseStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";

function normalize(text: string) {
  return text.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function readableLicenseKey(productCode: string) {
  const rand = randomBytes(5).toString("hex").toUpperCase();
  return `${normalize(productCode).slice(0, 8)}-${rand.slice(0, 4)}-${rand.slice(4, 8)}`;
}

function withExpiredStatus<T extends { status: LicenseStatus; expiresAt: Date }>(record: T) {
  const expired = record.status === LicenseStatus.ACTIVE && record.expiresAt < new Date();
  return {
    ...record,
    effectiveStatus: expired ? "EXPIRED" : record.status,
    isExpired: expired
  };
}

async function createAuditEvent(data: Prisma.AuditEventCreateInput) {
  await prisma.auditEvent.create({ data });
}

async function generateUniqueLicenseKey(productCode: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = readableLicenseKey(productCode);
    const existing = await prisma.license.findUnique({ where: { licenseKey: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }

  return `${normalize(productCode).slice(0, 8)}-${randomBytes(6).toString("hex").toUpperCase()}`;
}

export async function getDashboardSummary() {
  const [totalCustomers, totalActiveLicenses, totalExpiredLicenses, totalRevokedLicenses, recentActivations, recentAuditEvents] = await Promise.all([
    prisma.customer.count(),
    prisma.license.count({ where: { status: LicenseStatus.ACTIVE, expiresAt: { gte: new Date() } } }),
    prisma.license.count({ where: { OR: [{ status: LicenseStatus.EXPIRED }, { AND: [{ status: LicenseStatus.ACTIVE }, { expiresAt: { lt: new Date() } }] }] } }),
    prisma.license.count({ where: { status: LicenseStatus.REVOKED } }),
    prisma.auditEvent.findMany({
      where: { eventType: AuditEventType.ACTIVATE },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { license: { include: { customer: true, product: true } }, installation: true }
    }),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { license: { include: { customer: true, product: true } }, customer: true, product: true, installation: true }
    })
  ]);

  const recentRefresh = await prisma.auditEvent.findMany({
    where: { eventType: AuditEventType.REFRESH },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { license: { include: { customer: true, product: true } }, installation: true }
  });

  return {
    totalCustomers,
    totalActiveLicenses,
    totalExpiredLicenses,
    totalRevokedLicenses,
    recentActivations,
    recentRefresh,
    recentAuditEvents
  };
}

export async function listCustomers(search?: string) {
  return prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
            { email: { contains: search } }
          ]
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: { licenses: { select: { id: true } } }
  });
}

export async function getCustomer(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      licenses: {
        include: { product: true, plan: true },
        orderBy: { createdAt: "desc" }
      },
      auditEvents: { orderBy: { createdAt: "desc" }, take: 20 }
    }
  });
}

export async function createCustomer(input: { code?: string; name: string; email?: string; phone?: string; notes?: string; isActive?: boolean }) {
  const code = input.code ? normalize(input.code) : normalize(input.name);
  const customer = await prisma.customer.create({
    data: {
      code,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      notes: input.notes || null,
      isActive: input.isActive ?? true
    }
  });

  await createAuditEvent({
    eventType: AuditEventType.ADMIN_CREATE,
    customer: { connect: { id: customer.id } },
    payload: { type: "customer", name: customer.name }
  });

  return customer;
}

export async function updateCustomer(id: string, input: { code?: string; name?: string; email?: string; phone?: string; notes?: string; isActive?: boolean }) {
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(input.code ? { code: normalize(input.code) } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {})
    }
  });

  await createAuditEvent({
    eventType: AuditEventType.ADMIN_UPDATE,
    customer: { connect: { id: customer.id } },
    payload: { type: "customer" }
  });

  return customer;
}

export async function listProducts(search?: string) {
  return prisma.product.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } }
          ]
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: { plans: { select: { id: true } } }
  });
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      plans: { orderBy: { createdAt: "desc" } },
      licenses: { include: { customer: true, plan: true }, orderBy: { createdAt: "desc" }, take: 20 },
      installations: { orderBy: { createdAt: "desc" }, take: 20 }
    }
  });
}

export async function createProduct(input: { code?: string; name: string; notes?: string; isActive?: boolean }) {
  const product = await prisma.product.create({
    data: {
      code: input.code ? normalize(input.code) : normalize(input.name),
      name: input.name,
      notes: input.notes || null,
      isActive: input.isActive ?? true
    }
  });

  await createAuditEvent({
    eventType: AuditEventType.ADMIN_CREATE,
    product: { connect: { id: product.id } },
    payload: { type: "product", code: product.code }
  });

  return product;
}

export async function updateProduct(id: string, input: { code?: string; name?: string; notes?: string; isActive?: boolean }) {
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(input.code ? { code: normalize(input.code) } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {})
    }
  });

  await createAuditEvent({
    eventType: AuditEventType.ADMIN_UPDATE,
    product: { connect: { id: product.id } },
    payload: { type: "product" }
  });

  return product;
}

export async function listPlans(filter?: { search?: string; productId?: string }) {
  return prisma.licensePlan.findMany({
    where: {
      ...(filter?.productId ? { productId: filter.productId } : {}),
      ...(filter?.search
        ? {
            OR: [
              { name: { contains: filter.search } },
              { code: { contains: filter.search } }
            ]
          }
        : {})
    },
    orderBy: { createdAt: "desc" },
    include: { product: true, licenses: { select: { id: true } } }
  });
}

export async function getPlan(id: string) {
  return prisma.licensePlan.findUnique({
    where: { id },
    include: {
      product: true,
      licenses: { include: { customer: true }, orderBy: { createdAt: "desc" }, take: 20 }
    }
  });
}

export async function createPlan(input: {
  productId: string;
  code: string;
  name: string;
  durationDays?: number;
  maxCompanies?: number;
  maxWorkstations?: number;
  entitlements?: Prisma.InputJsonValue;
  notes?: string;
  isActive?: boolean;
}) {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) {
    throw new Error("Product not found");
  }

  const plan = await prisma.licensePlan.create({
    data: {
      productId: input.productId,
      code: normalize(input.code),
      name: input.name,
      durationDays: input.durationDays ?? null,
      maxCompanies: input.maxCompanies ?? null,
      maxWorkstations: input.maxWorkstations ?? null,
      entitlements: input.entitlements ?? {},
      notes: input.notes || null,
      isActive: input.isActive ?? true
    }
  });

  await createAuditEvent({
    eventType: AuditEventType.ADMIN_CREATE,
    product: { connect: { id: input.productId } },
    payload: { type: "plan", code: plan.code }
  });

  return plan;
}

export async function updatePlan(id: string, input: {
  productId?: string;
  code?: string;
  name?: string;
  durationDays?: number | null;
  maxCompanies?: number | null;
  maxWorkstations?: number | null;
  entitlements?: Prisma.InputJsonValue;
  notes?: string;
  isActive?: boolean;
}) {
  const plan = await prisma.licensePlan.update({
    where: { id },
    data: {
      ...(input.productId ? { productId: input.productId } : {}),
      ...(input.code ? { code: normalize(input.code) } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
      ...(input.maxCompanies !== undefined ? { maxCompanies: input.maxCompanies } : {}),
      ...(input.maxWorkstations !== undefined ? { maxWorkstations: input.maxWorkstations } : {}),
      ...(input.entitlements !== undefined ? { entitlements: input.entitlements } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {})
    }
  });

  await createAuditEvent({
    eventType: AuditEventType.ADMIN_UPDATE,
    product: { connect: { id: plan.productId } },
    payload: { type: "plan", planId: plan.id }
  });

  return plan;
}

export async function listLicenses(filter?: {
  search?: string;
  customerId?: string;
  productId?: string;
  status?: string;
}) {
  const licenses = await prisma.license.findMany({
    where: {
      ...(filter?.customerId ? { customerId: filter.customerId } : {}),
      ...(filter?.productId ? { productId: filter.productId } : {}),
      ...(filter?.status && filter.status !== "EXPIRED" ? { status: filter.status as LicenseStatus } : {}),
      ...(filter?.search
        ? {
            OR: [
              { licenseKey: { contains: filter.search } },
              { customer: { name: { contains: filter.search } } },
              { product: { code: { contains: filter.search } } },
              { product: { name: { contains: filter.search } } }
            ]
          }
        : {}),
      ...(filter?.status === "EXPIRED"
        ? {
            status: LicenseStatus.ACTIVE,
            expiresAt: { lt: new Date() }
          }
        : {})
    },
    orderBy: { createdAt: "desc" },
    include: { customer: true, product: true, plan: true, activations: { include: { installation: true }, orderBy: { activatedAt: "desc" } } }
  });

  return licenses.map(withExpiredStatus);
}

export async function getLicense(id: string) {
  const license = await prisma.license.findUnique({
    where: { id },
    include: {
      customer: true,
      product: true,
      plan: true,
      activationTokens: { orderBy: { createdAt: "desc" } },
      activations: { include: { installation: true }, orderBy: { activatedAt: "desc" } },
      events: { orderBy: { createdAt: "desc" } }
    }
  });

  return license ? withExpiredStatus(license) : null;
}

export async function createLicense(input: {
  customerId: string;
  productId: string;
  planId?: string;
  status?: LicenseStatus;
  startsAt?: string;
  expiresAt: string;
  notes?: string;
  overrides?: Prisma.InputJsonValue;
}) {
  const [customer, product, plan] = await Promise.all([
    prisma.customer.findUnique({ where: { id: input.customerId } }),
    prisma.product.findUnique({ where: { id: input.productId } }),
    input.planId ? prisma.licensePlan.findUnique({ where: { id: input.planId } }) : Promise.resolve(null)
  ]);

  if (!customer) {
    throw new Error("Customer not found");
  }

  if (!product) {
    throw new Error("Product not found");
  }

  if (plan && plan.productId !== product.id) {
    throw new Error("Plan does not belong to selected product");
  }

  if (input.status === LicenseStatus.EXPIRED) {
    throw new Error("Expired is derived from expiry date");
  }

  const licenseKey = await generateUniqueLicenseKey(product.code);
  const license = await prisma.license.create({
    data: {
      licenseKey,
      customerId: customer.id,
      productId: input.productId,
      planId: input.planId || null,
      status: input.status ?? LicenseStatus.ACTIVE,
      startsAt: input.startsAt ? new Date(input.startsAt) : new Date(),
      expiresAt: new Date(input.expiresAt),
      notes: input.notes || null,
      overrides: input.overrides ?? {}
    },
    include: { customer: true, product: true, plan: true }
  });

  await createAuditEvent({
    eventType: AuditEventType.ADMIN_CREATE,
    customer: { connect: { id: customer.id } },
    product: { connect: { id: input.productId } },
    license: { connect: { id: license.id } },
    payload: { type: "license", licenseKey }
  });

  return license;
}

export async function updateLicense(id: string, input: {
  customerId?: string;
  productId?: string;
  planId?: string | null;
  status?: LicenseStatus;
  startsAt?: string;
  expiresAt?: string;
  notes?: string;
  overrides?: Prisma.InputJsonValue | null;
}) {
  if (input.status === LicenseStatus.EXPIRED) {
    throw new Error("Expired is derived from expiry date");
  }

  const data: Prisma.LicenseUncheckedUpdateInput = {};
  if (input.customerId) data.customerId = input.customerId;
  if (input.productId) data.productId = input.productId;
  if (input.planId !== undefined) data.planId = input.planId;
  if (input.status) data.status = input.status;
  if (input.startsAt) data.startsAt = new Date(input.startsAt);
  if (input.expiresAt) data.expiresAt = new Date(input.expiresAt);
  if (input.notes !== undefined) data.notes = input.notes || null;
  if (input.overrides !== undefined) data.overrides = input.overrides === null ? Prisma.JsonNull : input.overrides;

  const license = await prisma.license.update({
    where: { id },
    data,
    include: { customer: true, product: true, plan: true }
  });

  await createAuditEvent({
    eventType: AuditEventType.ADMIN_UPDATE,
    license: { connect: { id: license.id } },
    product: { connect: { id: license.productId } },
    customer: license.customerId ? { connect: { id: license.customerId } } : undefined,
    payload: { type: "license" }
  });

  return withExpiredStatus(license);
}

export async function revokeLicense(id: string) {
  const license = await prisma.license.update({
    where: { id },
    data: { status: LicenseStatus.REVOKED },
    include: { customer: true, product: true, plan: true }
  });

  await createAuditEvent({
    eventType: AuditEventType.ADMIN_REVOKE,
    license: { connect: { id: license.id } },
    product: { connect: { id: license.productId } },
    customer: license.customerId ? { connect: { id: license.customerId } } : undefined,
    payload: { type: "license" }
  });

  return withExpiredStatus(license);
}

export async function suspendLicense(id: string) {
  const current = await prisma.license.findUnique({ where: { id }, select: { status: true } });
  if (!current) {
    throw new Error("License not found");
  }
  if (current.status !== LicenseStatus.ACTIVE) {
    throw new Error("Only active licenses can be suspended");
  }
  return updateLicense(id, { status: LicenseStatus.SUSPENDED });
}

export async function reactivateLicense(id: string) {
  const current = await prisma.license.findUnique({ where: { id }, select: { status: true } });
  if (!current) {
    throw new Error("License not found");
  }
  if (current.status !== LicenseStatus.SUSPENDED) {
    throw new Error("Only suspended licenses can be reactivated");
  }
  return updateLicense(id, { status: LicenseStatus.ACTIVE });
}

export async function extendLicense(id: string, expiresAt: string) {
  const current = await prisma.license.findUnique({ where: { id }, select: { status: true } });
  if (!current) {
    throw new Error("License not found");
  }
  if (current.status === LicenseStatus.REVOKED) {
    throw new Error("Revoked licenses cannot be extended");
  }
  return updateLicense(id, { expiresAt });
}

export async function createActivationLink(id: string) {
  const license = await prisma.license.findUnique({ where: { id } });
  if (!license) return null;
  if (license.status !== LicenseStatus.ACTIVE) {
    throw new Error("Activation links can only be created for active licenses");
  }

  const token = randomBytes(24).toString("hex");
  await prisma.activationToken.create({
    data: {
      licenseId: id,
      token
    }
  });

  await createAuditEvent({
    eventType: AuditEventType.ADMIN_CREATE,
    license: { connect: { id: license.id } },
    product: { connect: { id: license.productId } },
    customer: license.customerId ? { connect: { id: license.customerId } } : undefined,
    payload: { type: "activation-link" }
  });

  return token;
}

export async function listInstallations(filter?: { search?: string; licenseId?: string }) {
  return prisma.installation.findMany({
    where: {
      ...(filter?.licenseId ? { licenseId: filter.licenseId } : {}),
      ...(filter?.search
        ? {
            OR: [
              { appId: { contains: filter.search } },
              { machineFingerprintHash: { contains: filter.search } },
              {
                license: {
                  licenseKey: { contains: filter.search }
                }
              }
            ]
          }
        : {})
    },
    orderBy: { lastSeenAt: "desc" },
    include: { license: { include: { customer: true, product: true } }, product: true, activations: { orderBy: { activatedAt: "desc" } } }
  });
}

export async function getInstallation(id: string) {
  return prisma.installation.findUnique({
    where: { id },
    include: {
      license: { include: { customer: true, product: true, plan: true } },
      product: true,
      activations: { include: { license: true }, orderBy: { activatedAt: "desc" } },
      auditEvents: { orderBy: { createdAt: "desc" } }
    }
  });
}

export async function blockInstallation(id: string) {
  const installation = await prisma.installation.update({
    where: { id },
    data: { status: InstallationStatus.BLOCKED }
  });

  await createAuditEvent({
    eventType: AuditEventType.INSTALLATION_BLOCKED,
    installation: { connect: { id: installation.id } },
    product: { connect: { id: installation.productId } },
    license: installation.licenseId ? { connect: { id: installation.licenseId } } : undefined,
    payload: { type: "installation" }
  });

  return installation;
}

export async function listAuditEvents(filter?: { search?: string; licenseId?: string; customerId?: string; eventType?: string; from?: string; to?: string }) {
  const where: Prisma.AuditEventWhereInput = {
    ...(filter?.licenseId ? { licenseId: filter.licenseId } : {}),
    ...(filter?.customerId ? { customerId: filter.customerId } : {}),
    ...(filter?.eventType ? { eventType: filter.eventType as AuditEventType } : {}),
    ...(filter?.from || filter?.to
      ? {
          createdAt: {
            ...(filter?.from ? { gte: new Date(filter.from) } : {}),
            ...(filter?.to ? { lte: new Date(filter.to) } : {})
          }
        }
      : {}),
    ...(filter?.search
      ? {
          OR: [
            { actorId: { contains: filter.search } },
            { license: { licenseKey: { contains: filter.search } } }
          ]
        }
      : {})
  };

  return prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { customer: true, product: true, license: true, installation: true }
  });
}

export async function getAuditEvent(id: string) {
  return prisma.auditEvent.findUnique({
    where: { id },
    include: { customer: true, product: true, license: true, installation: true }
  });
}
