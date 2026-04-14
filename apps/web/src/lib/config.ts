function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required web env var ${name}. Set it in apps/web/.env or the VM environment.`);
  }
  return value.trim();
}

function optionalEnv(name: string) {
  const value = process.env[name];
  return value?.trim() || undefined;
}

function normalizeUrl(value: string, name: string) {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid URL in ${name}: ${value}`);
  }
}

function validateBcryptHash(value: string) {
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value)) {
    throw new Error("ADMIN_PASSWORD_HASH must be a bcrypt hash generated outside the app.");
  }
  return value;
}

export const webConfig = {
  siteUrl: normalizeUrl(requiredEnv("SITE_URL"), "SITE_URL"),
  apiBaseUrl: normalizeUrl(requiredEnv("API_BASE_URL"), "API_BASE_URL"),
  nextAuthSecret: requiredEnv("NEXTAUTH_SECRET"),
  adminUsername: requiredEnv("ADMIN_USERNAME"),
  adminPasswordHash: validateBcryptHash(requiredEnv("ADMIN_PASSWORD_HASH")),
  adminDisplayName: optionalEnv("ADMIN_DISPLAY_NAME"),
  adminApiToken: requiredEnv("ADMIN_API_TOKEN")
};
