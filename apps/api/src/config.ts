import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  API_PREFIX: z.string().default("/api/v1"),
  BASE_URL: z.string().default("https://license.loadinghappiness.pt"),
  DATABASE_URL: z.string(),
  JWT_ISSUER: z.string().default("license.loadinghappiness.pt"),
  JWT_AUDIENCE: z.string().default("EtiquetasLogisticaGS1"),
  LICENSE_GRACE_DAYS: z.coerce.number().default(15),
  SIGNING_KEY_ID: z.string().default("primary"),
  SIGNING_KEY_PRIVATE_PEM: z.string().optional(),
  SIGNING_KEY_PRIVATE_PEM_PATH: z.string().optional(),
  ADMIN_API_TOKEN: z.string(),
  EXTRA_PUBLIC_KEYS_PEM_PATHS: z.string().optional()
}).superRefine((value, ctx) => {
  if (!value.SIGNING_KEY_PRIVATE_PEM && !value.SIGNING_KEY_PRIVATE_PEM_PATH) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SIGNING_KEY_PRIVATE_PEM"],
      message: "Set SIGNING_KEY_PRIVATE_PEM or SIGNING_KEY_PRIVATE_PEM_PATH"
    });
  }

  if (value.ADMIN_API_TOKEN.trim().length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ADMIN_API_TOKEN"],
      message: "Set ADMIN_API_TOKEN to a long random secret used by the web app to access admin routes"
    });
  }
});

export const config = schema.parse(process.env);
