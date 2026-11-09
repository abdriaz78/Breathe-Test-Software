import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Augment NextAuth types. A session is either a staff session (role set) or a
// patient-portal session (role undefined, patientId set) — see src/lib/auth.ts.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      kind: "staff" | "patient";
      /** Staff only. Always undefined for patient sessions. */
      role?: Role;
      hospitalId: string | null;
      /** Patient-portal sessions only. */
      patientId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    hospitalId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    kind?: "staff" | "patient";
    uid: string;
    role?: Role;
    hospitalId: string | null;
    patientId?: string;
    /** sessionVersion at sign-in; a mismatch revokes the session. */
    sv?: number;
    revoked?: boolean;
  }
}
