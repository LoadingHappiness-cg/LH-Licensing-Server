import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { apiFetch } from "./api";

const adminGroupId = process.env.ENTRA_ADMIN_GROUP_ID || "";

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    redirect("/api/auth/signin");
  }

  if (!adminGroupId) {
    redirect("/api/auth/error?error=AccessDenied");
  }

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
  if (!adminGroupId) return false;
  if (!session) return false;
  return (session.groups || []).includes(adminGroupId) || (session.roles || []).includes(adminGroupId);
}
