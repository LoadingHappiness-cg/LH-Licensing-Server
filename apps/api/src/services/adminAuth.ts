import { timingSafeEqual } from "node:crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

function toBuffer(value: string) {
  return Buffer.from(value, "utf8");
}

function safeEqual(a: string, b: string) {
  const left = toBuffer(a);
  const right = toBuffer(b);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) {
    reply.code(401).send({ error: "Missing admin token" });
    return false;
  }

  if (!safeEqual(token, config.ADMIN_API_TOKEN)) {
    reply.code(403).send({ error: "Not authorized" });
    return false;
  }

  return true;
}
