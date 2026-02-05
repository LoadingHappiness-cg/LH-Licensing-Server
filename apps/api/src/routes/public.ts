import { FastifyInstance } from "fastify";
import { z } from "zod";
import { activateLicense, refreshLicense, getJwks } from "../services/license.js";

const activationSchema = z.object({
  activationToken: z.string().min(8),
  hardwareHash: z.string().min(8),
  appId: z.string().optional().default(""),
  appVersion: z.string().optional().default("")
});

const refreshSchema = z.object({
  licenseToken: z.string().min(10),
  hardwareHash: z.string().min(8),
  appId: z.string().optional().default(""),
  appVersion: z.string().optional().default("")
});

export async function registerPublicRoutes(app: FastifyInstance) {
  app.get("/.well-known/jwks.json", async () => {
    return getJwks();
  });

  app.post("/licenses/activate", async (request, reply) => {
    const body = activationSchema.safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const result = await activateLicense({
      ...body.data,
      ip: request.ip,
      userAgent: request.headers["user-agent"] || ""
    });

    if (!result.ok) {
      return reply.badRequest(result.error);
    }

    return { licenseToken: result.licenseToken };
  });

  app.post("/licenses/refresh", async (request, reply) => {
    const body = refreshSchema.safeParse(request.body);
    if (!body.success) {
      return reply.badRequest(body.error.message);
    }

    const result = await refreshLicense({
      ...body.data,
      ip: request.ip,
      userAgent: request.headers["user-agent"] || ""
    });

    if (!result.ok) {
      return reply.badRequest(result.error);
    }

    return { licenseToken: result.licenseToken };
  });
}
