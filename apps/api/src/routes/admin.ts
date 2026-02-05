import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../services/entra.js";
import {
  listLicenses,
  getLicense,
  createLicense,
  updateLicense,
  revokeLicense,
  createActivationLink
} from "../services/license.js";

const createSchema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email().optional(),
  planName: z.string().min(1),
  maxCompanies: z.coerce.number().int().min(1),
  maxWorkstations: z.coerce.number().int().min(1),
  expiresAt: z.string().optional()
});

const updateSchema = z.object({
  planName: z.string().min(1).optional(),
  maxCompanies: z.coerce.number().int().min(1).optional(),
  maxWorkstations: z.coerce.number().int().min(1).optional(),
  status: z.enum(["ACTIVE", "REVOKED", "SUSPENDED"]).optional(),
  expiresAt: z.string().optional()
});

export async function registerAdminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const ok = await requireAdmin(request, reply);
    if (!ok) {
      return;
    }
  });

  app.get("/licenses", async () => listLicenses());

  app.get("/licenses/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const license = await getLicense(id);
    if (!license) {
      return reply.notFound("License not found");
    }
    return license;
  });

  app.post("/licenses", async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const license = await createLicense(body.data);
    return reply.code(201).send(license);
  });

  app.patch("/licenses/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = updateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const license = await updateLicense(id, body.data);
    if (!license) {
      return reply.notFound("License not found");
    }

    return license;
  });

  app.post("/licenses/:id/revoke", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const license = await revokeLicense(id);
    if (!license) {
      return reply.notFound("License not found");
    }
    return license;
  });

  app.post("/licenses/:id/activation-link", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const link = await createActivationLink(id);
    if (!link) {
      return reply.notFound("License not found");
    }
    return { activationLink: link };
  });
}
