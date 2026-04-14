import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { after, before, test } from "node:test";
import { AuditEventType, InstallationStatus, LicenseStatus } from "@prisma/client";

const licenseKid = "test-license-key";
const jwtIssuer = "license.test";
const jwtAudience = "EtiquetasGS1Test";
const adminApiToken = "test-admin-api-token-0123456789abcdef0123456789abcdef";
const appId = "EtiquetasGS1";
const appVersion = "1.0.0";
const hardwareHash = "HW-1234567890";

type PrismaClient = typeof import("../../src/db/prisma.ts").prisma;
type BuildServer = typeof import("../../src/server.ts").buildServer;
type SignLicenseToken = typeof import("../../src/services/jwt.ts").signLicenseToken;

let prisma: PrismaClient;
let buildServer: BuildServer;
let signLicenseToken: SignLicenseToken;
let app: Awaited<ReturnType<BuildServer>>;
let adminToken: string;

function requireDatabaseUrl() {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Set TEST_DATABASE_URL or DATABASE_URL before running integration tests");
  }
  process.env.DATABASE_URL = databaseUrl;
}

function futureDate(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function pastDate(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function addMonthsUtc(base: Date, months: number) {
  const result = new Date(base.getTime());
  const dayOfMonth = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDayOfMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth));

  return result;
}

function jsonBody(response: { body: string }) {
  return response.body ? JSON.parse(response.body) : {};
}

function makeLicenseTokenPrefix() {
  return `IT_${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function adminRequest(
  method: "GET" | "POST" | "PATCH",
  url: string,
  payload?: unknown
) {
  const headers: Record<string, string> = {
    authorization: `Bearer ${adminToken}`
  };

  if (payload !== undefined) {
    headers["content-type"] = "application/json";
  }

  return app.inject({
    method,
    url,
    headers,
    payload: payload === undefined ? undefined : JSON.stringify(payload)
  });
}

async function publicRequest(
  method: "POST",
  url: string,
  payload: Record<string, unknown>
) {
  return app.inject({
    method,
    url,
    headers: {
      "content-type": "application/json"
    },
    payload: JSON.stringify(payload)
  });
}

async function createFixture(options?: {
  status?: LicenseStatus;
  expiresAt?: Date;
  withActivationToken?: boolean;
}) {
  const prefix = makeLicenseTokenPrefix();
  const customer = await prisma.customer.create({
    data: {
      code: `${prefix}_CUSTOMER`,
      name: `${prefix} Customer`,
      email: `${prefix.toLowerCase()}@example.test`,
      isActive: true
    }
  });

  const product = await prisma.product.create({
    data: {
      code: `${prefix}_PRODUCT`,
      name: `${prefix} Product`,
      isActive: true
    }
  });

  const plan = await prisma.licensePlan.create({
    data: {
      productId: product.id,
      code: "BASIC",
      name: `${prefix} Basic`,
      durationDays: 30,
      maxCompanies: 1,
      maxWorkstations: 1,
      entitlements: {}
    }
  });

  const license = await prisma.license.create({
    data: {
      licenseKey: `${prefix}-LICENSE`,
      customerId: customer.id,
      productId: product.id,
      planId: plan.id,
      status: options?.status ?? LicenseStatus.ACTIVE,
      startsAt: new Date(),
      expiresAt: options?.expiresAt ?? futureDate(30),
      notes: `${prefix} notes`,
      overrides: {}
    }
  });

  const activationToken = options?.withActivationToken === false
    ? null
    : await prisma.activationToken.create({
        data: {
          licenseId: license.id,
          token: `${prefix}-ACTIVATION`
        }
      });

  return {
    prefix,
    customer,
    product,
    plan,
    license,
    activationToken,
    cleanup: async () => {
      const licenseIds = [license.id];
      const productIds = [product.id];
      const customerIds = [customer.id];
      const planIds = [plan.id];
      const installationIds = (
        await prisma.installation.findMany({
          where: { OR: [{ licenseId: license.id }, { productId: product.id }] },
          select: { id: true }
        })
      ).map((row) => row.id);

      const allLicenseIds = licenseIds;

      await prisma.auditEvent.deleteMany({
        where: {
          OR: [
            { licenseId: { in: allLicenseIds } },
            { customerId: { in: customerIds } },
            { productId: { in: productIds } },
            { installationId: { in: installationIds } }
          ]
        }
      });
      await prisma.activation.deleteMany({ where: { OR: [{ licenseId: { in: allLicenseIds } }, { installationId: { in: installationIds } }] } });
      await prisma.activationToken.deleteMany({ where: { licenseId: { in: allLicenseIds } } });
      await prisma.installation.deleteMany({ where: { id: { in: installationIds } } });
      await prisma.license.deleteMany({ where: { id: { in: allLicenseIds } } });
      await prisma.licensePlan.deleteMany({ where: { id: { in: planIds } } });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    }
  };
}

before(async () => {
  requireDatabaseUrl();

  process.env.ADMIN_API_TOKEN = adminApiToken;
  process.env.SIGNING_KEY_ID = licenseKid;
  process.env.SIGNING_KEY_PRIVATE_PEM = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
    format: "pem",
    type: "pkcs8"
  }).toString();
  process.env.JWT_ISSUER = jwtIssuer;
  process.env.JWT_AUDIENCE = jwtAudience;
  process.env.LICENSE_GRACE_DAYS = "14";

  const appMod = await import("../../src/server.ts");
  const prismaMod = await import("../../src/db/prisma.ts");
  const jwtMod = await import("../../src/services/jwt.ts");
  buildServer = appMod.buildServer;
  prisma = prismaMod.prisma;
  signLicenseToken = jwtMod.signLicenseToken;
  app = await buildServer();
  adminToken = adminApiToken;
});

after(async () => {
  await app?.close();
  await prisma?.$disconnect();
});

test("activate succeeds for an active license and creates canonical installation plus activation records", async () => {
  const fixture = await createFixture();
  try {
    const response = await publicRequest("POST", "/api/v1/licenses/activate", {
      activationToken: fixture.activationToken?.token,
      hardwareHash,
      appId,
      appVersion
    });

    assert.equal(response.statusCode, 200);
    const body = jsonBody(response);
    assert.ok(body.licenseToken);

    const installation = await prisma.installation.findFirst({
      where: { licenseId: fixture.license.id, appId, machineFingerprintHash: hardwareHash }
    });
    assert.ok(installation);
    assert.equal(installation?.status, InstallationStatus.ACTIVE);

    const activations = await prisma.activation.findMany({
      where: { licenseId: fixture.license.id, installationId: installation!.id }
    });
    assert.equal(activations.length, 1);

    const events = await prisma.auditEvent.findMany({
      where: { licenseId: fixture.license.id }
    });
    assert.ok(events.some((event) => event.eventType === AuditEventType.ACTIVATE));
  } finally {
    await fixture.cleanup();
  }
});

test("refresh succeeds for the same active installation and license pair", async () => {
  const fixture = await createFixture();
  try {
    const activateResponse = await publicRequest("POST", "/api/v1/licenses/activate", {
      activationToken: fixture.activationToken?.token,
      hardwareHash,
      appId,
      appVersion
    });
    assert.equal(activateResponse.statusCode, 200);
    const activateBody = jsonBody(activateResponse);

    const refreshResponse = await publicRequest("POST", "/api/v1/licenses/refresh", {
      licenseToken: activateBody.licenseToken,
      hardwareHash,
      appId,
      appVersion: "1.0.1"
    });

    assert.equal(refreshResponse.statusCode, 200);
    const refreshBody = jsonBody(refreshResponse);
    assert.ok(refreshBody.licenseToken);

    const activation = await prisma.activation.findFirst({
      where: { licenseId: fixture.license.id }
    });
    assert.ok(activation);
    assert.ok(activation?.lastRefreshedAt);

    const events = await prisma.auditEvent.findMany({
      where: { licenseId: fixture.license.id }
    });
    assert.ok(events.some((event) => event.eventType === AuditEventType.REFRESH));
  } finally {
    await fixture.cleanup();
  }
});

test("refresh fails after license revocation", async () => {
  const fixture = await createFixture();
  try {
    const activateResponse = await publicRequest("POST", "/api/v1/licenses/activate", {
      activationToken: fixture.activationToken?.token,
      hardwareHash,
      appId,
      appVersion
    });
    const activateBody = jsonBody(activateResponse);

    const revokeResponse = await adminRequest("POST", `/api/v1/admin/licenses/${fixture.license.id}/revoke`);
    assert.equal(revokeResponse.statusCode, 200);

    const refreshResponse = await publicRequest("POST", "/api/v1/licenses/refresh", {
      licenseToken: activateBody.licenseToken,
      hardwareHash,
      appId,
      appVersion: "1.0.1"
    });

    assert.equal(refreshResponse.statusCode, 400);
    assert.match(refreshResponse.body, /License not active/);

    const events = await prisma.auditEvent.findMany({
      where: { licenseId: fixture.license.id }
    });
    assert.ok(events.some((event) => event.eventType === AuditEventType.ADMIN_REVOKE));
  } finally {
    await fixture.cleanup();
  }
});

test("activate fails for suspended license", async () => {
  const fixture = await createFixture({ status: LicenseStatus.SUSPENDED });
  try {
    const response = await publicRequest("POST", "/api/v1/licenses/activate", {
      activationToken: fixture.activationToken?.token,
      hardwareHash,
      appId,
      appVersion
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /License not active/);

    const installationCount = await prisma.installation.count({
      where: { licenseId: fixture.license.id }
    });
    assert.equal(installationCount, 0);
  } finally {
    await fixture.cleanup();
  }
});

test("activate fails for expired license", async () => {
  const fixture = await createFixture({ expiresAt: pastDate(30) });
  try {
    const response = await publicRequest("POST", "/api/v1/licenses/activate", {
      activationToken: fixture.activationToken?.token,
      hardwareHash,
      appId,
      appVersion
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /License expired/);

    const activationCount = await prisma.activation.count({
      where: { licenseId: fixture.license.id }
    });
    assert.equal(activationCount, 0);
  } finally {
    await fixture.cleanup();
  }
});

test("refresh fails for blocked installation", async () => {
  const fixture = await createFixture();
  try {
    const activateResponse = await publicRequest("POST", "/api/v1/licenses/activate", {
      activationToken: fixture.activationToken?.token,
      hardwareHash,
      appId,
      appVersion
    });
    const activateBody = jsonBody(activateResponse);

    const installation = await prisma.installation.findFirst({
      where: { licenseId: fixture.license.id }
    });
    assert.ok(installation);

    const blockResponse = await adminRequest("POST", `/api/v1/admin/installations/${installation!.id}/block`);
    assert.equal(blockResponse.statusCode, 200);

    const refreshResponse = await publicRequest("POST", "/api/v1/licenses/refresh", {
      licenseToken: activateBody.licenseToken,
      hardwareHash,
      appId,
      appVersion: "1.0.1"
    });

    assert.equal(refreshResponse.statusCode, 400);
    assert.match(refreshResponse.body, /Installation blocked/);

    const blockedInstallation = await prisma.installation.findUnique({
      where: { id: installation!.id }
    });
    assert.equal(blockedInstallation?.status, InstallationStatus.BLOCKED);

    const events = await prisma.auditEvent.findMany({
      where: { installationId: installation!.id }
    });
    assert.ok(events.some((event) => event.eventType === AuditEventType.INSTALLATION_BLOCKED));
  } finally {
    await fixture.cleanup();
  }
});

test("blocked installation can be unblocked by admin", async () => {
  const fixture = await createFixture();
  try {
    const activateResponse = await publicRequest("POST", "/api/v1/licenses/activate", {
      activationToken: fixture.activationToken?.token,
      hardwareHash,
      appId,
      appVersion
    });
    const activateBody = jsonBody(activateResponse);

    const installation = await prisma.installation.findFirst({
      where: { licenseId: fixture.license.id }
    });
    assert.ok(installation);

    const blockResponse = await adminRequest("POST", `/api/v1/admin/installations/${installation!.id}/block`);
    assert.equal(blockResponse.statusCode, 200);

    const unblockResponse = await adminRequest("POST", `/api/v1/admin/installations/${installation!.id}/unblock`);
    assert.equal(unblockResponse.statusCode, 200);

    const refreshResponse = await publicRequest("POST", "/api/v1/licenses/refresh", {
      licenseToken: activateBody.licenseToken,
      hardwareHash,
      appId,
      appVersion: "1.0.1"
    });
    assert.equal(refreshResponse.statusCode, 200);

    const unblockedInstallation = await prisma.installation.findUnique({
      where: { id: installation!.id }
    });
    assert.equal(unblockedInstallation?.status, InstallationStatus.ACTIVE);
    assert.equal(unblockedInstallation?.licenseId, fixture.license.id);

    const events = await prisma.auditEvent.findMany({
      where: { installationId: installation!.id }
    });
    assert.ok(events.some((event) => event.eventType === AuditEventType.INSTALLATION_BLOCKED));
    assert.ok(events.some((event) => event.eventType === AuditEventType.INSTALLATION_UNBLOCKED));
  } finally {
    await fixture.cleanup();
  }
});

test("activate and refresh fail when the installation is bound to a different license", async () => {
  const firstFixture = await createFixture();
  const secondFixture = await createFixture({ withActivationToken: false });
  try {
    const firstActivate = await publicRequest("POST", "/api/v1/licenses/activate", {
      activationToken: firstFixture.activationToken?.token,
      hardwareHash,
      appId,
      appVersion
    });
    assert.equal(firstActivate.statusCode, 200);

    const secondActivationToken = await prisma.activationToken.create({
      data: {
        licenseId: secondFixture.license.id,
        token: `${secondFixture.prefix}-SECOND-ACTIVATION`
      }
    });

    const secondLicenseToken = await signLicenseToken(secondFixture.license as any, {
      company: secondFixture.customer.name,
      plan: secondFixture.plan.name,
      max_companies: secondFixture.plan.maxCompanies ?? 1,
      max_workstations: secondFixture.plan.maxWorkstations ?? 1,
      hw: hardwareHash,
      product: secondFixture.product.code
    });

    const activateResponse = await publicRequest("POST", "/api/v1/licenses/activate", {
      activationToken: secondActivationToken.token,
      hardwareHash,
      appId,
      appVersion
    });
    assert.equal(activateResponse.statusCode, 400);
    assert.match(activateResponse.body, /Installation bound to different license/);

    const refreshResponse = await publicRequest("POST", "/api/v1/licenses/refresh", {
      licenseToken: secondLicenseToken,
      hardwareHash,
      appId,
      appVersion: "1.0.1"
    });
    assert.equal(refreshResponse.statusCode, 400);
    assert.match(refreshResponse.body, /Installation bound to different license/);

    const secondInstallations = await prisma.installation.findMany({
      where: { licenseId: secondFixture.license.id }
    });
    assert.equal(secondInstallations.length, 0);
  } finally {
    await firstFixture.cleanup();
    await secondFixture.cleanup();
  }
});

test("rearm extends an active license from its current expiry and records an audit event", async () => {
  const fixture = await createFixture({ expiresAt: new Date("2026-06-15T12:00:00.000Z") });
  try {
    const response = await adminRequest("POST", `/api/v1/admin/licenses/${fixture.license.id}/rearm`, {
      months: 3
    });

    assert.equal(response.statusCode, 200);
    const body = jsonBody(response);
    assert.equal(body.id, fixture.license.id);
    assert.equal(new Date(body.expiresAt).toISOString(), "2026-09-15T12:00:00.000Z");

    const updatedLicense = await prisma.license.findUnique({
      where: { id: fixture.license.id }
    });
    assert.ok(updatedLicense);
    assert.equal(updatedLicense?.expiresAt.toISOString(), "2026-09-15T12:00:00.000Z");

    const auditEvents = await prisma.auditEvent.findMany({
      where: { licenseId: fixture.license.id },
      orderBy: { createdAt: "desc" }
    });
    const rearmEvent = auditEvents.find((event) => event.payload && (event.payload as any).type === "license-rearm");
    assert.ok(rearmEvent);
    assert.equal(rearmEvent?.eventType, AuditEventType.ADMIN_UPDATE);
    assert.equal((rearmEvent?.payload as any)?.months, 3);
    assert.equal((rearmEvent?.payload as any)?.previousExpiresAt, "2026-06-15T12:00:00.000Z");
    assert.equal((rearmEvent?.payload as any)?.newExpiresAt, "2026-09-15T12:00:00.000Z");
  } finally {
    await fixture.cleanup();
  }
});

test("rearm extends an expired license from the current time window", async () => {
  const fixture = await createFixture({ expiresAt: pastDate(40) });
  try {
    const before = new Date();
    const response = await adminRequest("POST", `/api/v1/admin/licenses/${fixture.license.id}/rearm`, {
      months: 1
    });
    const after = new Date();

    assert.equal(response.statusCode, 200);
    const body = jsonBody(response);
    const resultingExpiresAt = new Date(body.expiresAt);
    const lowerBound = addMonthsUtc(before, 1);
    const upperBound = addMonthsUtc(after, 1);

    assert.ok(resultingExpiresAt >= lowerBound && resultingExpiresAt <= upperBound);

    const auditEvents = await prisma.auditEvent.findMany({
      where: { licenseId: fixture.license.id },
      orderBy: { createdAt: "desc" }
    });
    const rearmEvent = auditEvents.find((event) => event.payload && (event.payload as any).type === "license-rearm");
    assert.ok(rearmEvent);
    assert.equal((rearmEvent?.payload as any)?.months, 1);
  } finally {
    await fixture.cleanup();
  }
});

test("activation-link generation is unavailable for non-active licenses", async () => {
  const fixture = await createFixture({ status: LicenseStatus.SUSPENDED, withActivationToken: false });
  try {
    const response = await adminRequest(
      "POST",
      `/api/v1/admin/licenses/${fixture.license.id}/activation-link`
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body, /active licenses/i);

    const tokenCount = await prisma.activationToken.count({
      where: { licenseId: fixture.license.id }
    });
    assert.equal(tokenCount, 0);
  } finally {
    await fixture.cleanup();
  }
});

test("activation-link generation succeeds for an active license", async () => {
  const fixture = await createFixture({ withActivationToken: false });
  try {
    const response = await adminRequest(
      "POST",
      `/api/v1/admin/licenses/${fixture.license.id}/activation-link`
    );

    assert.equal(response.statusCode, 200);
    const body = jsonBody(response);
    assert.ok(body.activationToken);

    const activationTokens = await prisma.activationToken.findMany({
      where: { licenseId: fixture.license.id }
    });
    assert.equal(activationTokens.length, 1);
    assert.equal(activationTokens[0]?.token, body.activationToken);
  } finally {
    await fixture.cleanup();
  }
});

test("renewal cadence on a plan is persisted and copied onto a license snapshot", async () => {
  const fixture = await createFixture({ withActivationToken: false });
  let planId = "";
  let licenseId = "";

  try {
    const createPlanResponse = await adminRequest("POST", "/api/v1/admin/license-plans", {
      productId: fixture.product.id,
      code: "QUARTERLY_LOCAL",
      name: "Quarterly Local",
      durationDays: 90,
      renewalCadenceMonths: 3,
      maxCompanies: 1,
      maxWorkstations: 1,
      entitlements: { refresh: true }
    });

    assert.equal(createPlanResponse.statusCode, 201);
    const createdPlan = jsonBody(createPlanResponse);
    planId = createdPlan.id;
    assert.equal(createdPlan.renewalCadenceMonths, 3);

    const createLicenseResponse = await adminRequest("POST", "/api/v1/admin/licenses", {
      customerId: fixture.customer.id,
      productId: fixture.product.id,
      planId,
      expiresAt: futureDate(30).toISOString()
    });

    assert.equal(createLicenseResponse.statusCode, 201);
    const createdLicense = jsonBody(createLicenseResponse);
    licenseId = createdLicense.id;
    assert.equal(createdLicense.renewalCadenceMonths, 3);
    assert.equal(createdLicense.renewalCadenceSource, "PLAN");

    const fetchedLicense = await adminRequest("GET", `/api/v1/admin/licenses/${licenseId}`);
    assert.equal(fetchedLicense.statusCode, 200);
    const fetchedBody = jsonBody(fetchedLicense);
    assert.equal(fetchedBody.renewalCadenceMonths, 3);
    assert.equal(fetchedBody.renewalCadenceSource, "PLAN");
  } finally {
    if (licenseId) {
      await prisma.auditEvent.deleteMany({
        where: { OR: [{ licenseId }, { productId: fixture.product.id }] }
      });
      await prisma.activation.deleteMany({ where: { licenseId } });
      await prisma.activationToken.deleteMany({ where: { licenseId } });
      await prisma.installation.deleteMany({ where: { licenseId } });
      await prisma.license.deleteMany({ where: { id: licenseId } });
    }
    if (planId) {
      await prisma.licensePlan.deleteMany({ where: { id: planId } });
    }
    await fixture.cleanup();
  }
});

test("changing a plan cadence does not rewrite an existing license snapshot", async () => {
  const fixture = await createFixture({ withActivationToken: false });
  let planId = "";
  let licenseId = "";

  try {
    const createPlanResponse = await adminRequest("POST", "/api/v1/admin/license-plans", {
      productId: fixture.product.id,
      code: "MONTHLY_LOCAL",
      name: "Monthly Local",
      durationDays: 30,
      renewalCadenceMonths: 1,
      maxCompanies: 1,
      maxWorkstations: 1,
      entitlements: { refresh: true }
    });

    assert.equal(createPlanResponse.statusCode, 201);
    const createdPlan = jsonBody(createPlanResponse);
    planId = createdPlan.id;

    const createLicenseResponse = await adminRequest("POST", "/api/v1/admin/licenses", {
      customerId: fixture.customer.id,
      productId: fixture.product.id,
      planId,
      expiresAt: futureDate(30).toISOString()
    });

    assert.equal(createLicenseResponse.statusCode, 201);
    const createdLicense = jsonBody(createLicenseResponse);
    licenseId = createdLicense.id;
    assert.equal(createdLicense.renewalCadenceMonths, 1);
    assert.equal(createdLicense.renewalCadenceSource, "PLAN");

    const updatePlanResponse = await adminRequest("PATCH", `/api/v1/admin/license-plans/${planId}`, {
      renewalCadenceMonths: 12
    });
    assert.equal(updatePlanResponse.statusCode, 200);

    const fetchedLicense = await adminRequest("GET", `/api/v1/admin/licenses/${licenseId}`);
    assert.equal(fetchedLicense.statusCode, 200);
    const fetchedBody = jsonBody(fetchedLicense);
    assert.equal(fetchedBody.renewalCadenceMonths, 1);
    assert.equal(fetchedBody.renewalCadenceSource, "PLAN");
  } finally {
    if (licenseId) {
      await prisma.auditEvent.deleteMany({
        where: { OR: [{ licenseId }, { productId: fixture.product.id }] }
      });
      await prisma.activation.deleteMany({ where: { licenseId } });
      await prisma.activationToken.deleteMany({ where: { licenseId } });
      await prisma.installation.deleteMany({ where: { licenseId } });
      await prisma.license.deleteMany({ where: { id: licenseId } });
    }
    if (planId) {
      await prisma.licensePlan.deleteMany({ where: { id: planId } });
    }
    await fixture.cleanup();
  }
});
