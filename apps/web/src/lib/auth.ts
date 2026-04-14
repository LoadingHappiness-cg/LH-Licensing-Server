import AzureADProvider from "next-auth/providers/azure-ad";
import type { NextAuthOptions } from "next-auth";
import { webConfig } from "./config";

function decodeJwtPayload(token?: string | null) {
  if (!token) return {};
  const parts = token.split(".");
  if (parts.length < 2) return {};
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

function uniqueClaims(...values: Array<string[] | undefined>) {
  return [...new Set(values.flatMap((value) => value || []))];
}

export const authOptions: NextAuthOptions = {
  secret: webConfig.nextAuthSecret,
  providers: [
    AzureADProvider({
      clientId: webConfig.entraClientId,
      clientSecret: webConfig.entraClientSecret,
      tenantId: webConfig.entraTenantId
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      if (account?.id_token) {
        token.idToken = account.id_token;
        const claims = decodeJwtPayload(account.id_token) as { groups?: string[]; roles?: string[] };
        token.groups = uniqueClaims(claims.groups);
        token.roles = uniqueClaims(claims.roles);
      }
      return token;
    },
    async session({ session, token }) {
      if (token.accessToken) {
        (session as any).accessToken = token.accessToken;
      }
      (session as any).groups = token.groups || [];
      (session as any).roles = token.roles || [];
      return session;
    }
  }
};

process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || webConfig.siteUrl;
