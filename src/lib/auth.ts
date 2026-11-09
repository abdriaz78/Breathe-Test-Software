import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import {
  verifyStaffCredentials,
  verifyPatientCredentials,
  revalidateSession,
  type StaffIdentity,
  type PatientIdentity,
} from "./credentials";

// -----------------------------------------------------------------------------
// NextAuth configuration — JWT sessions, two credential providers:
//
//   "credentials"  staff (email + password)      -> token.kind = "staff"
//   "patient"      patient portal (MRN + password) -> token.kind = "patient"
//
// The two kinds never mix: staff helpers (requireUser) reject patient sessions
// and the portal helpers (requirePatient) reject staff sessions; middleware
// additionally fences each kind into its own part of the app.
//
// Every server-side session read re-validates the token against the DB
// (account active, sessionVersion unchanged), so deactivating a user,
// resetting a password or disabling portal access takes effect immediately,
// and role/hospital changes are picked up without a re-login.
// -----------------------------------------------------------------------------

type Identity = StaffIdentity | PatientIdentity;

function reqContext(req: { headers?: Record<string, unknown> } | undefined) {
  const h = (req?.headers ?? {}) as Record<string, string | undefined>;
  const ip = h["x-forwarded-for"]?.split(",")[0]?.trim() || h["x-real-ip"] || null;
  return { ipAddress: ip, userAgent: h["user-agent"] ?? null };
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8-hour clinical shift
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Staff",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;
        const who = await verifyStaffCredentials(credentials.email, credentials.password, reqContext(req));
        return who as unknown as import("next-auth").User | null;
      },
    }),
    CredentialsProvider({
      id: "patient",
      name: "Patient portal",
      credentials: {
        mrn: { label: "MRN", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.mrn || !credentials.password) return null;
        const who = await verifyPatientCredentials(credentials.mrn, credentials.password, reqContext(req));
        return who as unknown as import("next-auth").User | null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as Identity;
        token.kind = u.kind;
        token.uid = u.id;
        token.sv = u.sessionVersion;
        token.hospitalId = u.hospitalId;
        if (u.kind === "staff") {
          token.role = u.role;
        } else {
          token.patientId = u.patientId;
          delete token.role;
          // Never put PHI (the patient's name) in the token.
          token.name = u.name;
          delete token.email;
        }
        return token;
      }

      // Existing session: confirm it is still valid and refresh identity.
      const fresh = await revalidateSession(token);
      if (!fresh) {
        token.revoked = true;
        return token;
      }
      token.revoked = false;
      token.hospitalId = fresh.hospitalId;
      if (fresh.kind === "staff") {
        token.role = fresh.role;
        token.name = fresh.name;
        token.email = fresh.email;
      } else {
        token.patientId = fresh.patientId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.revoked || !token.uid) {
        // Signals "signed out" to every caller (session.user is falsy).
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (session.user) {
        session.user.id = token.uid;
        session.user.kind = token.kind === "patient" ? "patient" : "staff";
        session.user.role = token.kind === "patient" ? undefined : token.role;
        session.user.hospitalId = token.hospitalId ?? null;
        session.user.patientId = token.kind === "patient" ? token.patientId : undefined;
      }
      return session;
    },
  },
};

/** Server-side session accessor for pages, route handlers, and server actions. */
export function auth() {
  return getServerSession(authOptions);
}
