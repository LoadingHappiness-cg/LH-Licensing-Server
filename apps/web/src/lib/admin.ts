import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { apiFetch } from "./api";
import { webConfig } from "./config";

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/api/auth/signin");
  }

  const adminGroupId = webConfig.entraAdminGroupId;
  const groups = session.groups || [];
  const roles = session.roles || [];
  if (!groups.includes(adminGroupId) && !roles.includes(adminGroupId)) {
    redirect("/api/auth/error?error=AccessDenied");
  }

  return session;
}

export async function adminFetch<T>(path: string, init: RequestInit = {}) {
  const session = await requireAdminSession();
  return apiFetch<T>(path, session.accessToken!, init);
}

export function isAdminAuthorized(session: { groups?: string[]; roles?: string[] } | null | undefined) {
  if (!session) return false;
  const adminGroupId = webConfig.entraAdminGroupId;
  return (session.groups || []).includes(adminGroupId) || (session.roles || []).includes(adminGroupId);
}
