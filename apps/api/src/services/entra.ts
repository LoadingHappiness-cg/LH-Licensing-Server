import { createRemoteJWKSet, jwtVerify } from "jose";
import { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

const authority = config.ENTRA_AUTHORITY_HOST;
const tenant = config.ENTRA_TENANT_ID || "";
const jwksUrl = tenant ? `${authority}/${tenant}/discovery/v2.0/keys` : "";
const issuer = tenant ? `${authority}/${tenant}/v2.0` : "";
const jwks = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null;

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!config.ENTRA_TENANT_ID || !config.ENTRA_CLIENT_ID || !jwks) {
    if (!config.ADMIN_API_KEY) {
      reply.code(503).send({ error: "Admin auth not configured" });
      return false;
    }

    const key = request.headers["x-admin-key"];
    if (key !== config.ADMIN_API_KEY) {
      reply.code(401).send({ error: "Invalid admin key" });
      return false;
    }

    return true;
  }

  const auth = request.headers.authorization || "";
  const token = auth.startsWith("Bearer " ) ? auth.slice(7) : "";
  if (!token) {
    reply.code(401).send({ error: "Missing bearer token" });
    return false;
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: config.ENTRA_CLIENT_ID
    });

    if (config.ENTRA_ADMIN_GROUP_ID) {
      const groups = (payload.groups as string[] | undefined) || (payload.roles as string[] | undefined) || [];
      if (!groups.includes(config.ENTRA_ADMIN_GROUP_ID)) {
        reply.code(403).send({ error: "Not authorized" });
        return false;
      }
    }

    return true;
  } catch (err) {
    reply.code(401).send({ error: "Invalid token" });
    return false;
  }
}
