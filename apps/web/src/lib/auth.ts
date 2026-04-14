import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";
import { webConfig } from "./config";

export const authOptions: NextAuthOptions = {
  secret: webConfig.nextAuthSecret,
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Admin login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim() || "";
        const password = credentials?.password || "";

        if (!username || !password) {
          return null;
        }

        if (username !== webConfig.adminUsername) {
          return null;
        }

        const ok = await bcrypt.compare(password, webConfig.adminPasswordHash);
        if (!ok) {
          return null;
        }

        return {
          id: "local-admin",
          name: webConfig.adminDisplayName || webConfig.adminUsername,
          email: webConfig.adminUsername,
          isAdmin: true,
          username: webConfig.adminUsername,
          displayName: webConfig.adminDisplayName || webConfig.adminUsername
        };
      }
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.isAdmin = Boolean((user as { isAdmin?: boolean }).isAdmin);
        token.username = (user as { username?: string }).username;
        token.displayName = (user as { displayName?: string }).displayName;
      }
      return token;
    },
    async session({ session, token }) {
      const isAdmin = Boolean(token.isAdmin);
      session.isAdmin = isAdmin;
      session.user = {
        name: (token.displayName as string | undefined) || session.user?.name || webConfig.adminDisplayName || webConfig.adminUsername,
        email: (token.username as string | undefined) || session.user?.email || webConfig.adminUsername
      };
      return session;
    }
  }
};

process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || webConfig.siteUrl;
