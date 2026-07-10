import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { recordAudit } from "./audit";

// -----------------------------------------------------------------------------
// NextAuth configuration — email/password credentials with JWT sessions.
// Role is embedded in the token/session so RBAC checks need no extra DB round-trip.
// -----------------------------------------------------------------------------

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8-hour clinical shift
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await recordAudit({
          action: "LOGIN",
          entity: "User",
          entityId: user.id,
          actorId: user.id,
          actorRole: user.role,
          summary: `${user.email} signed in`,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};

/** Server-side session accessor for pages, route handlers, and server actions. */
export function auth() {
  return getServerSession(authOptions);
}
