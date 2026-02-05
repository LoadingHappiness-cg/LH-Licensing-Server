import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { config } from "./config.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerAdminRoutes } from "./routes/admin.js";

export async function buildServer() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(sensible);

  app.get("/health", async () => ({ ok: true }));

  await app.register(registerPublicRoutes, { prefix: config.API_PREFIX });
  await app.register(registerAdminRoutes, { prefix: `${config.API_PREFIX}/admin` });

  return app;
}
