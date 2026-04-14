import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../services/adminAuth.js";
import {
  blockInstallation,
  createCustomer,
  createLicense,
  createPlan,
  createProduct,
  createActivationLink,
  extendLicense,
  getAuditEvent,
  getCustomer,
  getDashboardSummary,
  getInstallation,
  getLicense,
  getPlan,
  getProduct,
  listAuditEvents,
  listCustomers,
  listInstallations,
  listLicenses,
  listPlans,
  listProducts,
  reactivateLicense,
  revokeLicense,
  suspendLicense,
  updateCustomer,
  updateLicense,
  updatePlan,
  updateProduct
} from "../services/admin.js";

const statusSchema = z.enum(["ACTIVE", "REVOKED", "SUSPENDED"]);
const installationStatusSchema = z.enum(["ACTIVE", "BLOCKED", "REVOKED"]);

const customerSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  isActive: z.coerce.boolean().optional()
});

const productSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(2),
  notes: z.string().optional().or(z.literal("")),
  isActive: z.coerce.boolean().optional()
});

const planSchema = z.object({
  productId: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(2),
  durationDays: z.coerce.number().int().positive().optional().or(z.literal("")),
  maxCompanies: z.coerce.number().int().positive().optional().or(z.literal("")),
  maxWorkstations: z.coerce.number().int().positive().optional().or(z.literal("")),
  entitlements: z.any().optional(),
  notes: z.string().optional().or(z.literal("")),
  isActive: z.coerce.boolean().optional()
});

const licenseSchema = z.object({
  customerId: z.string().uuid(),
  productId: z.string().uuid(),
  planId: z.string().uuid().optional().or(z.literal("")),
  status: statusSchema.optional(),
  startsAt: z.string().optional().or(z.literal("")),
  expiresAt: z.string().min(1),
  notes: z.string().optional().or(z.literal("")),
  overrides: z.any().optional()
});

const licenseUpdateSchema = z.object({
  customerId: z.string().uuid().optional().or(z.literal("")),
  productId: z.string().uuid().optional().or(z.literal("")),
  planId: z.string().uuid().optional().or(z.literal("")),
  startsAt: z.string().optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  overrides: z.any().optional()
});

const listQuery = z.object({
  search: z.string().optional(),
  customerId: z.string().optional(),
  productId: z.string().optional(),
  licenseId: z.string().optional(),
  status: z.string().optional()
});

const eventQuery = z.object({
  search: z.string().optional(),
  licenseId: z.string().optional(),
  customerId: z.string().optional(),
  eventType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional()
});

function parseJsonInput(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Invalid JSON");
  }
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const ok = await requireAdmin(request, reply);
    if (!ok) {
      return;
    }
  });

  app.get("/dashboard", async () => getDashboardSummary());

  app.get("/customers", async (request) => {
    const query = listQuery.parse(request.query);
    return listCustomers(query.search);
  });

  app.get("/customers/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const customer = await getCustomer(id);
    if (!customer) {
      return reply.notFound("Customer not found");
    }
    return customer;
  });

  app.post("/customers", async (request, reply) => {
    const body = customerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const customer = await createCustomer({
      ...body.data,
      email: body.data.email || undefined,
      phone: body.data.phone || undefined,
      notes: body.data.notes || undefined
    });

    return reply.code(201).send(customer);
  });

  app.patch("/customers/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = customerSchema.partial().safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const customer = await updateCustomer(id, {
      ...body.data,
      email: body.data.email || undefined,
      phone: body.data.phone || undefined,
      notes: body.data.notes || undefined
    });
    return customer;
  });

  app.get("/products", async (request) => {
    const query = listQuery.parse(request.query);
    return listProducts(query.search);
  });

  app.get("/products/:id", async (request, reply) => {
    const product = await getProduct((request.params as { id: string }).id);
    if (!product) {
      return reply.notFound("Product not found");
    }
    return product;
  });

  app.post("/products", async (request, reply) => {
    const body = productSchema.safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const product = await createProduct({
      ...body.data,
      notes: body.data.notes || undefined
    });
    return reply.code(201).send(product);
  });

  app.patch("/products/:id", async (request, reply) => {
    const body = productSchema.partial().safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const product = await updateProduct((request.params as { id: string }).id, {
      ...body.data,
      notes: body.data.notes || undefined
    });
    return product;
  });

  app.get("/license-plans", async (request) => {
    const query = listQuery.parse(request.query);
    return listPlans({ search: query.search, productId: query.productId });
  });

  app.get("/license-plans/:id", async (request, reply) => {
    const plan = await getPlan((request.params as { id: string }).id);
    if (!plan) {
      return reply.notFound("Plan not found");
    }
    return plan;
  });

  app.post("/license-plans", async (request, reply) => {
    const body = planSchema.safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const plan = await createPlan({
      productId: body.data.productId,
      code: body.data.code,
      name: body.data.name,
      durationDays: typeof body.data.durationDays === "number" ? body.data.durationDays : undefined,
      maxCompanies: typeof body.data.maxCompanies === "number" ? body.data.maxCompanies : undefined,
      maxWorkstations: typeof body.data.maxWorkstations === "number" ? body.data.maxWorkstations : undefined,
      entitlements: body.data.entitlements ?? {},
      notes: body.data.notes || undefined,
      isActive: body.data.isActive
    });
    return reply.code(201).send(plan);
  });

  app.patch("/license-plans/:id", async (request, reply) => {
    const body = planSchema.partial().safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const plan = await updatePlan((request.params as { id: string }).id, {
      productId: body.data.productId,
      code: body.data.code,
      name: body.data.name,
      durationDays: body.data.durationDays === "" ? undefined : body.data.durationDays,
      maxCompanies: body.data.maxCompanies === "" ? undefined : body.data.maxCompanies,
      maxWorkstations: body.data.maxWorkstations === "" ? undefined : body.data.maxWorkstations,
      entitlements: body.data.entitlements,
      notes: body.data.notes || undefined,
      isActive: body.data.isActive
    });
    return plan;
  });

  app.get("/licenses", async (request) => {
    const query = listQuery.parse(request.query);
    return listLicenses({
      search: query.search,
      customerId: query.customerId,
      productId: query.productId,
      status: query.status
    });
  });

  app.get("/licenses/:id", async (request, reply) => {
    const license = await getLicense((request.params as { id: string }).id);
    if (!license) {
      return reply.notFound("License not found");
    }
    return license;
  });

  app.post("/licenses", async (request, reply) => {
    const body = licenseSchema.safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const license = await createLicense({
      customerId: body.data.customerId,
      productId: body.data.productId,
      planId: body.data.planId || undefined,
      status: body.data.status,
      startsAt: body.data.startsAt || undefined,
      expiresAt: body.data.expiresAt,
      notes: body.data.notes || undefined,
      overrides: body.data.overrides ?? {}
    });

    return reply.code(201).send(license);
  });

  app.patch("/licenses/:id", async (request, reply) => {
    const body = licenseUpdateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const license = await updateLicense((request.params as { id: string }).id, {
      customerId: body.data.customerId || undefined,
      productId: body.data.productId || undefined,
      planId: body.data.planId === "" ? undefined : body.data.planId,
      startsAt: body.data.startsAt || undefined,
      expiresAt: body.data.expiresAt || undefined,
      notes: body.data.notes || undefined,
      overrides: body.data.overrides
    });

    return license;
  });

  app.post("/licenses/:id/revoke", async (request, reply) => {
    const license = await revokeLicense((request.params as { id: string }).id);
    if (!license) {
      return reply.notFound("License not found");
    }
    return license;
  });

  app.post("/licenses/:id/suspend", async (request, reply) => {
    const license = await suspendLicense((request.params as { id: string }).id);
    if (!license) {
      return reply.notFound("License not found");
    }
    return license;
  });

  app.post("/licenses/:id/reactivate", async (request, reply) => {
    const license = await reactivateLicense((request.params as { id: string }).id);
    if (!license) {
      return reply.notFound("License not found");
    }
    return license;
  });

  app.post("/licenses/:id/extend", async (request, reply) => {
    const body = z.object({ expiresAt: z.string().min(1) }).safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const license = await extendLicense((request.params as { id: string }).id, body.data.expiresAt);
    if (!license) {
      return reply.notFound("License not found");
    }
    return license;
  });

  app.post("/licenses/:id/activation-link", async (request, reply) => {
    try {
      const token = await createActivationLink((request.params as { id: string }).id);
      if (!token) {
        return reply.notFound("License not found");
      }
      return { activationToken: token };
    } catch (error: any) {
      return reply.badRequest(error?.message || "Unable to create activation link");
    }
  });

  app.get("/installations", async (request) => {
    const query = listQuery.parse(request.query);
    return listInstallations({
      search: query.search,
      licenseId: query.licenseId
    });
  });

  app.get("/installations/:id", async (request, reply) => {
    const installation = await getInstallation((request.params as { id: string }).id);
    if (!installation) {
      return reply.notFound("Installation not found");
    }
    return installation;
  });

  app.post("/installations/:id/block", async (request, reply) => {
    const installation = await blockInstallation((request.params as { id: string }).id);
    if (!installation) {
      return reply.notFound("Installation not found");
    }
    return installation;
  });

  app.get("/audit-events", async (request) => {
    const query = eventQuery.parse(request.query);
    return listAuditEvents(query);
  });

  app.get("/audit-events/:id", async (request, reply) => {
    const event = await getAuditEvent((request.params as { id: string }).id);
    if (!event) {
      return reply.notFound("Audit event not found");
    }
    return event;
  });
}
