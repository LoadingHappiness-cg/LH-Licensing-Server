import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2] || "keys";
fs.mkdirSync(outDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});

fs.writeFileSync(path.join(outDir, "private.pem"), privateKey);
fs.writeFileSync(path.join(outDir, "public.pem"), publicKey);

console.log(`Keys written to ${outDir}`);
