import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import { recordAudit } from "./audit";
import { loadReportData, type ReportData } from "./report";
import { authorize, isOutsideScope, type CurrentPatient, type CurrentUser } from "./session";

// -----------------------------------------------------------------------------
// Patient portal.
//
// Staff side (permission portal:manage, hospital-scoped): issue or reset a
// patient's portal login — which generates a one-time temporary password shown
// to staff once — or disable it.
//
// Patient side: a patient can see ONLY their own FINALIZED reports. Every
// patient-side query is keyed on the patientId from the signed session, never
// on anything the browser sends, and single-report lookups re-check both
// ownership and status, returning "not found" for anything else.
// -----------------------------------------------------------------------------

type Ctx = { ipAddress: string | null; userAgent: string | null };

// No 0/O, 1/l/I — the password is read out or handed over on paper.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateTempPassword(): string {
  const chars = Array.from({ length: 12 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8).join("")}`;
}

export const patientPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use at least one letter and one number");

export interface PortalAccessStatus {
  enabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  lockedUntil: Date | null;
  createdAt: Date | null;
}

async function loadScopedPatient(actor: CurrentUser, patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, mrn: true, hospitalId: true, portalAccount: true },
  });
  if (!patient || isOutsideScope(actor, patient.hospitalId)) throw new Error("Patient not found.");
  return patient;
}

/** Portal status for the staff patient page. */
export async function getPortalAccess(actor: CurrentUser, patientId: string): Promise<PortalAccessStatus> {
  authorize(actor.role, "portal:manage");
  const { portalAccount: a } = await loadScopedPatient(actor, patientId);
  return {
    enabled: !!a?.isActive,
    mustChangePassword: a?.mustChangePassword ?? false,
    lastLoginAt: a?.lastLoginAt ?? null,
    lockedUntil: a?.lockedUntil && a.lockedUntil > new Date() ? a.lockedUntil : null,
    createdAt: a?.createdAt ?? null,
  };
}

/**
 * Create or reset a patient's portal login. Returns the temporary password —
 * the only time it exists in plaintext. Resetting revokes existing sessions
 * and clears any lock; the patient must choose a new password on next sign-in.
 */
export async function issuePortalAccess(
  actor: CurrentUser,
  patientId: string,
  ctx: Ctx
): Promise<{ tempPassword: string; mrn: string }> {
  authorize(actor.role, "portal:manage");
  const patient = await loadScopedPatient(actor, patientId);

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const existed = !!patient.portalAccount;

  await prisma.patientAccount.upsert({
    where: { patientId },
    create: { patientId, passwordHash, mustChangePassword: true, createdById: actor.id },
    update: {
      passwordHash,
      mustChangePassword: true,
      isActive: true,
      failedLoginCount: 0,
      lockedUntil: null,
      sessionVersion: { increment: 1 },
    },
  });

  await recordAudit({
    action: existed ? "UPDATE" : "CREATE",
    entity: "PatientAccount",
    entityId: patientId,
    actorId: actor.id,
    actorRole: actor.role,
    summary: `${existed ? "Reset" : "Issued"} patient-portal access (MRN ${patient.mrn})`,
    metadata: { patientId, hospitalId: patient.hospitalId },
    ...ctx,
  });

  return { tempPassword, mrn: patient.mrn };
}

/** Disable a patient's portal login and sign out any open sessions. */
export async function disablePortalAccess(actor: CurrentUser, patientId: string, ctx: Ctx): Promise<void> {
  authorize(actor.role, "portal:manage");
  const patient = await loadScopedPatient(actor, patientId);
  if (!patient.portalAccount?.isActive) return;

  await prisma.patientAccount.update({
    where: { patientId },
    data: { isActive: false, sessionVersion: { increment: 1 } },
  });
  await recordAudit({
    action: "UPDATE",
    entity: "PatientAccount",
    entityId: patientId,
    actorId: actor.id,
    actorRole: actor.role,
    summary: `Disabled patient-portal access (MRN ${patient.mrn})`,
    metadata: { patientId, hospitalId: patient.hospitalId },
    ...ctx,
  });
}

// ------------------------------ Patient side ---------------------------------

export interface PortalProfile {
  name: string;
  mrn: string;
  hospitalName: string;
  hospitalCity: string | null;
}

export async function getOwnProfile(me: Pick<CurrentPatient, "patientId">): Promise<PortalProfile | null> {
  const p = await prisma.patient.findUnique({
    where: { id: me.patientId },
    select: { mrn: true, nameEnc: true, hospital: { select: { name: true, city: true } } },
  });
  if (!p) return null;
  return { name: decrypt(p.nameEnc) ?? "—", mrn: p.mrn, hospitalName: p.hospital.name, hospitalCity: p.hospital.city };
}

export interface PortalReport {
  id: string;
  testTypeName: string;
  collectionDate: Date | null;
  finalizedAt: Date | null;
}

/** The signed-in patient's own finalized reports, newest first. */
export async function listOwnReports(me: Pick<CurrentPatient, "patientId">): Promise<PortalReport[]> {
  const rows = await prisma.breathTest.findMany({
    where: { patientId: me.patientId, status: "FINALIZED" },
    orderBy: [{ finalizedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, collectionDate: true, finalizedAt: true, testType: { select: { name: true } } },
  });
  return rows.map((t) => ({
    id: t.id,
    testTypeName: t.testType.name,
    collectionDate: t.collectionDate,
    finalizedAt: t.finalizedAt,
  }));
}

/** Full report data for one of the patient's OWN finalized reports, or null
 * (also null for another patient's report or an unfinalized one, so the
 * response never reveals that the id exists). */
export async function loadOwnReport(
  me: Pick<CurrentPatient, "patientId" | "accountId">,
  testId: string,
  ctx: Ctx
): Promise<ReportData | null> {
  const owner = await prisma.breathTest.findUnique({
    where: { id: testId },
    select: { patientId: true, status: true },
  });
  if (!owner || owner.patientId !== me.patientId || owner.status !== "FINALIZED") return null;

  const data = await loadReportData(testId);
  if (!data) return null;

  await recordAudit({
    action: "EXPORT",
    entity: "BreathTest",
    entityId: testId,
    breathTestId: testId,
    summary: `Patient downloaded own report via portal (MRN ${data.patient.mrn})`,
    metadata: { format: "pdf", channel: "patient-portal", patientAccountId: me.accountId },
    ...ctx,
  });
  return data;
}

/** Patient changes their own password (required after a staff-issued one). */
export async function changeOwnPassword(
  me: Pick<CurrentPatient, "accountId" | "patientId">,
  currentPassword: string,
  newPassword: string,
  ctx: Ctx
): Promise<void> {
  const parsed = patientPasswordSchema.safeParse(newPassword);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid password.");

  const account = await prisma.patientAccount.findUnique({
    where: { id: me.accountId },
    select: { passwordHash: true, patientId: true, isActive: true, patient: { select: { mrn: true } } },
  });
  if (!account || !account.isActive || account.patientId !== me.patientId) throw new Error("Account not found.");

  if (!(await bcrypt.compare(currentPassword, account.passwordHash))) {
    throw new Error("Your current password is incorrect.");
  }
  if (currentPassword === newPassword) throw new Error("Choose a password different from the current one.");
  if (newPassword.toLowerCase().includes(account.patient.mrn.toLowerCase())) {
    throw new Error("Your password must not contain your MRN.");
  }

  await prisma.patientAccount.update({
    where: { id: me.accountId },
    data: { passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false },
  });
  await recordAudit({
    action: "UPDATE",
    entity: "PatientAccount",
    entityId: me.patientId,
    summary: `Patient changed their portal password (MRN ${account.patient.mrn})`,
    metadata: { patientAccountId: me.accountId },
    ...ctx,
  });
}
