import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { apiFetch } from "./api";
import { webConfig } from "./config";

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.isAdmin) {
    redirect("/login");
  }

  return session;
}

export async function adminFetch<T>(path: string, init: RequestInit = {}) {
  await requireAdminSession();
  return apiFetch<T>(path, webConfig.adminApiToken, init);
}

export function isAdminAuthorized(session: { isAdmin?: boolean } | null | undefined) {
  return Boolean(session?.isAdmin);
}
