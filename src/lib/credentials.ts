import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { recordAudit } from "./audit";
import { blindIndex } from "./crypto";

// -----------------------------------------------------------------------------
// Credential verification for the two sign-in flows (staff and patient), with
// brute-force protection. Kept out of auth.ts so it can be unit-tested without
// NextAuth.
//
//  * After MAX_FAILED_ATTEMPTS consecutive failures an account is locked for
//    LOCK_MINUTES. A successful sign-in resets the counter.
//  * Unknown identifiers still run a bcrypt compare against a dummy hash, so
//    response time does not reveal whether an account exists.
//  * Every failure is audited (no passwords, no PHI).
// -----------------------------------------------------------------------------

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export const LOCKED_MESSAGE = `Too many failed attempts. This account is locked for ${LOCK_MINUTES} minutes.`;

// A real bcrypt hash (same cost as stored passwords) of a random value nobody
// knows, computed once; comparing against it equalises response timing.
let dummyHash: string | null = null;
function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync(crypto.randomUUID(), 10);
  return dummyHash;
}

type Ctx = { ipAddress?: string | null; userAgent?: string | null };

export interface StaffIdentity {
  kind: "staff";
  id: string;
  email: string;
  name: string;
  role: Role;
  hospitalId: string | null;
  sessionVersion: number;
}

export interface PatientIdentity {
  kind: "patient";
  id: string; // PatientAccount id
  patientId: string;
  hospitalId: string;
  name: string;
  sessionVersion: number;
}

export class AccountLockedError extends Error {
  constructor() {
    super(LOCKED_MESSAGE);
    this.name = "AccountLockedError";
  }
}

function isLocked(lockedUntil: Date | null): boolean {
  return !!lockedUntil && lockedUntil.getTime() > Date.now();
}

/** Counter update after a failed attempt; locks once the limit is reached. */
function failureUpdate(currentCount: number) {
  const next = currentCount + 1;
  return next >= MAX_FAILED_ATTEMPTS
    ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
    : { failedLoginCount: next };
}

/** Staff (email + password). Returns null on bad credentials; throws
 * AccountLockedError while locked. */
export async function verifyStaffCredentials(
  emailRaw: string,
  password: string,
  ctx: Ctx = {}
): Promise<StaffIdentity | null> {
  const email = emailRaw.toLowerCase().trim();
  if (!email || !password) return null;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await bcrypt.compare(password, getDummyHash());
    await recordAudit({ action: "LOGIN", entity: "User", summary: "Failed staff sign-in (unknown account)", metadata: { outcome: "failed" }, ...ctx });
    return null;
  }
  if (isLocked(user.lockedUntil)) {
    await recordAudit({ action: "LOGIN", entity: "User", entityId: user.id, summary: `Sign-in refused for ${user.email}: account locked`, metadata: { outcome: "locked" }, ...ctx });
    throw new AccountLockedError();
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok || !user.isActive) {
    const update = ok ? {} : failureUpdate(user.failedLoginCount);
    if (!ok) await prisma.user.update({ where: { id: user.id }, data: update });
    await recordAudit({
      action: "LOGIN", entity: "User", entityId: user.id,
      summary: `Failed sign-in for ${user.email}${!user.isActive ? " (account deactivated)" : ""}`,
      metadata: { outcome: "failed", locked: "lockedUntil" in update },
      ...ctx,
    });
    return null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  await recordAudit({
    action: "LOGIN", entity: "User", entityId: user.id,
    actorId: user.id, actorRole: user.role,
    summary: `${user.email} signed in`, ...ctx,
  });

  return {
    kind: "staff",
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hospitalId: user.hospitalId,
    sessionVersion: user.sessionVersion,
  };
}

/** Patient (MRN + password). Same lockout semantics as staff. */
export async function verifyPatientCredentials(
  mrnRaw: string,
  password: string,
  ctx: Ctx = {}
): Promise<PatientIdentity | null> {
  const mrn = mrnRaw.trim();
  if (!mrn || !password) return null;

  const patient = await prisma.patient.findUnique({
    where: { mrnHash: blindIndex(mrn) },
    select: { id: true, mrn: true, hospitalId: true, portalAccount: true, hospital: { select: { isActive: true } } },
  });
  const account = patient?.portalAccount ?? null;

  if (!patient || !account) {
    await bcrypt.compare(password, getDummyHash());
    await recordAudit({ action: "LOGIN", entity: "PatientAccount", summary: "Failed patient-portal sign-in (no portal access)", metadata: { outcome: "failed" }, ...ctx });
    return null;
  }
  if (isLocked(account.lockedUntil)) {
    await recordAudit({ action: "LOGIN", entity: "PatientAccount", entityId: patient.id, summary: `Patient-portal sign-in refused (MRN ${patient.mrn}): account locked`, metadata: { outcome: "locked" }, ...ctx });
    throw new AccountLockedError();
  }

  const ok = await bcrypt.compare(password, account.passwordHash);
  const usable = account.isActive && patient.hospital.isActive;
  if (!ok || !usable) {
    const update = ok ? {} : failureUpdate(account.failedLoginCount);
    if (!ok) await prisma.patientAccount.update({ where: { id: account.id }, data: update });
    await recordAudit({
      action: "LOGIN", entity: "PatientAccount", entityId: patient.id,
      summary: `Failed patient-portal sign-in (MRN ${patient.mrn})${!usable ? " (access disabled)" : ""}`,
      metadata: { outcome: "failed", locked: "lockedUntil" in update },
      ...ctx,
    });
    return null;
  }

  await prisma.patientAccount.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  await recordAudit({
    action: "LOGIN", entity: "PatientAccount", entityId: patient.id,
    summary: `Patient signed in to the portal (MRN ${patient.mrn})`,
    metadata: { patientId: patient.id }, ...ctx,
  });

  return {
    kind: "patient",
    id: account.id,
    patientId: patient.id,
    hospitalId: patient.hospitalId,
    name: `MRN ${patient.mrn}`,
    sessionVersion: account.sessionVersion,
  };
}

/**
 * Re-checks that a signed session is still valid against the database: the
 * account still exists, is active, and its sessionVersion is unchanged (a
 * password reset or disable bumps it). Returns the fresh identity fields, or
 * null to revoke. Called on every server-side session read.
 */
export async function revalidateSession(token: {
  kind?: string;
  uid?: string;
  sv?: number;
}): Promise<
  | { kind: "staff"; role: Role; hospitalId: string | null; name: string; email: string }
  | { kind: "patient"; patientId: string; hospitalId: string }
  | null
> {
  if (!token.uid) return null;
  if (token.kind === "patient") {
    const a = await prisma.patientAccount.findUnique({
      where: { id: token.uid },
      select: { isActive: true, sessionVersion: true, patientId: true, patient: { select: { hospitalId: true, hospital: { select: { isActive: true } } } } },
    });
    if (!a || !a.isActive || !a.patient.hospital.isActive || a.sessionVersion !== (token.sv ?? 0)) return null;
    return { kind: "patient", patientId: a.patientId, hospitalId: a.patient.hospitalId };
  }
  const u = await prisma.user.findUnique({
    where: { id: token.uid },
    select: { isActive: true, sessionVersion: true, role: true, hospitalId: true, name: true, email: true },
  });
  if (!u || !u.isActive || u.sessionVersion !== (token.sv ?? 0)) return null;
  return { kind: "staff", role: u.role, hospitalId: u.hospitalId, name: u.name, email: u.email };
}
