import fs from "node:fs";
import path from "node:path";
import { createPrivateKey, createPublicKey, KeyObject } from "node:crypto";
import { decodeProtectedHeader, exportJWK, jwtVerify, SignJWT } from "jose";
import { config } from "../config.js";
import type { License } from "@prisma/client";

let cached: {
  privateKey: KeyObject;
  publicKey: KeyObject;
  extraPublicKeys: KeyObject[];
  jwks: { keys: any[] };
} | null = null;

function readPemFromPath(p: string) {
  return fs.readFileSync(path.resolve(p), "utf8");
}

function getPrivatePem() {
  if (config.SIGNING_KEY_PRIVATE_PEM) return config.SIGNING_KEY_PRIVATE_PEM;
  if (config.SIGNING_KEY_PRIVATE_PEM_PATH) return readPemFromPath(config.SIGNING_KEY_PRIVATE_PEM_PATH);
  throw new Error("SIGNING_KEY_PRIVATE_PEM or SIGNING_KEY_PRIVATE_PEM_PATH required");
}

async function loadKeys() {
  if (cached) return cached;

  const privatePem = getPrivatePem();
  const privateKey = createPrivateKey(privatePem);
  const publicKey = createPublicKey(privateKey);

  const primaryJwk = await exportJWK(publicKey);
  primaryJwk.kid = config.SIGNING_KEY_ID;
  primaryJwk.use = "sig";
  primaryJwk.alg = "RS256";

  const extraPublicKeys: KeyObject[] = [];
  const extraJwks: any[] = [];

  if (config.EXTRA_PUBLIC_KEYS_PEM_PATHS) {
    const paths = config.EXTRA_PUBLIC_KEYS_PEM_PATHS.split(",").map((p) => p.trim()).filter(Boolean);
    for (const p of paths) {
      const pem = readPemFromPath(p);
      const key = createPublicKey(pem);
      extraPublicKeys.push(key);
      const jwk = await exportJWK(key);
      jwk.kid = `extra-${extraPublicKeys.length}`;
      jwk.use = "sig";
      jwk.alg = "RS256";
      extraJwks.push(jwk);
    }
  }

  cached = {
    privateKey,
    publicKey,
    extraPublicKeys,
    jwks: { keys: [primaryJwk, ...extraJwks] }
  };

  return cached;
}

export async function getJwks() {
  const keys = await loadKeys();
  return keys.jwks;
}

export async function signLicenseToken(license: License, payload: Record<string, unknown>) {
  const keys = await loadKeys();

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: config.SIGNING_KEY_ID })
    .setIssuer(config.JWT_ISSUER)
    .setAudience(config.JWT_AUDIENCE)
    .setSubject(license.customerId || license.id)
    .setJti(license.id)
    .setIssuedAt()
    .setExpirationTime(license.expiresAt);

  return jwt.sign(keys.privateKey);
}

export async function verifyLicenseToken(token: string) {
  const keys = await loadKeys();
  const header = decodeProtectedHeader(token);

  const keyMap = new Map<string, KeyObject>();
  keyMap.set(config.SIGNING_KEY_ID, keys.publicKey);
  keys.extraPublicKeys.forEach((k, idx) => keyMap.set(`extra-${idx + 1}`, k));

  if (header.kid && keyMap.has(header.kid)) {
    return jwtVerify(token, keyMap.get(header.kid)!, {
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE
    });
  }

  const allKeys = [keys.publicKey, ...keys.extraPublicKeys];
  for (const key of allKeys) {
    try {
      return await jwtVerify(token, key, {
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE
      });
    } catch {
      // try next
    }
  }

  throw new Error("Invalid license token");
}
