function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required web env var ${name}. Set it in apps/web/.env or the VM environment.`);
  }
  return value.trim();
}

function normalizeUrl(value: string, name: string) {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid URL in ${name}: ${value}`);
  }
}

export const webConfig = {
  siteUrl: normalizeUrl(requiredEnv("SITE_URL"), "SITE_URL"),
  apiBaseUrl: normalizeUrl(requiredEnv("API_BASE_URL"), "API_BASE_URL"),
  nextAuthSecret: requiredEnv("NEXTAUTH_SECRET"),
  entraTenantId: requiredEnv("ENTRA_TENANT_ID"),
  entraClientId: requiredEnv("ENTRA_CLIENT_ID"),
  entraClientSecret: requiredEnv("ENTRA_CLIENT_SECRET"),
  entraAdminGroupId: requiredEnv("ENTRA_ADMIN_GROUP_ID")
};
