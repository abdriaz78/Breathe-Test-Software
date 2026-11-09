import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { assertCan, can, isHospitalScoped, type Permission } from "./rbac";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  hospitalId: string | null;
}

/** Converts a session into a staff actor, or null if it is not a valid staff
 * session (signed out, revoked, or a patient-portal session). Route handlers
 * that call auth() directly must go through this — never read
 * session.user.role on its own. */
export function staffFromSession(session: Session | null): CurrentUser | null {
  const u = session?.user;
  if (!u || u.kind === "patient" || !u.role) return null;
  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email ?? "",
    role: u.role,
    hospitalId: u.hospitalId ?? null,
  };
}

/** Returns the signed-in staff user or redirects (patients go to their portal). */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  if (session?.user?.kind === "patient") redirect("/portal");
  const user = staffFromSession(session);
  if (!user) redirect("/login");
  return user;
}

/**
 * A Prisma `where` fragment restricting a `hospitalId`-bearing model to the
 * actor's own hospital. Unrestricted ({}) for ADMIN/SPECTER_SUPPORT. A scoped
 * user with no hospital assigned yet is restricted to a value that matches
 * nothing, so they fail closed (see zero records) rather than see everything.
 */
export function hospitalScope(actor: CurrentUser): { hospitalId?: string } {
  if (!isHospitalScoped(actor.role)) return {};
  return { hospitalId: actor.hospitalId ?? "__no_hospital_assigned__" };
}

/** True if `hospitalId` is outside the actor's scope (always false for
 * unscoped roles). Use to gate access to a single already-fetched record. */
export function isOutsideScope(actor: CurrentUser, hospitalId: string | null | undefined): boolean {
  if (!isHospitalScoped(actor.role)) return false;
  return !actor.hospitalId || hospitalId !== actor.hospitalId;
}

/** Returns the user if they hold `permission`; otherwise redirects appropriately. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/?error=forbidden");
  return user;
}

/** For server actions / API: throws 403 if the user lacks the permission. */
export function authorize(role: Role, permission: Permission): void {
  assertCan(role, permission);
}

// ----------------------------- Patient portal --------------------------------

export interface CurrentPatient {
  accountId: string;
  patientId: string;
  hospitalId: string;
  mustChangePassword: boolean;
}

/** Converts a session into a patient-portal identity, or null. */
export function patientFromSession(session: Session | null): Omit<CurrentPatient, "mustChangePassword"> | null {
  const u = session?.user;
  if (!u || u.kind !== "patient" || !u.patientId || !u.hospitalId) return null;
  return { accountId: u.id, patientId: u.patientId, hospitalId: u.hospitalId };
}

/**
 * Returns the signed-in patient (portal pages only). Staff are sent back to
 * the staff app. Unless `allowPendingPassword`, a patient still holding a
 * staff-issued temporary password is forced to the change-password page
 * before they can see anything else.
 */
export async function requirePatient(opts: { allowPendingPassword?: boolean } = {}): Promise<CurrentPatient> {
  const session = await auth();
  if (session?.user && session.user.kind !== "patient") redirect("/");
  const p = patientFromSession(session);
  if (!p) redirect("/portal/login");

  const account = await prisma.patientAccount.findUnique({
    where: { id: p.accountId },
    select: { mustChangePassword: true, isActive: true, patientId: true },
  });
  if (!account || !account.isActive || account.patientId !== p.patientId) redirect("/portal/login");
  if (account.mustChangePassword && !opts.allowPendingPassword) redirect("/portal/change-password");

  return { ...p, mustChangePassword: account.mustChangePassword };
}

/** Best-effort client IP + user agent for audit records. */
export async function requestContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  return { ipAddress: ip, userAgent: h.get("user-agent") };
}
