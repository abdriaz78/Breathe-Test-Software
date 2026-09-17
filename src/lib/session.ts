import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Role } from "@prisma/client";
import { auth } from "./auth";
import { assertCan, can, isHospitalScoped, type Permission } from "./rbac";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  hospitalId: string | null;
}

/** Returns the signed-in user or redirects to /login. Use in server components. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    hospitalId: session.user.hospitalId,
  };
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
  return hospitalId !== actor.hospitalId;
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

/** Best-effort client IP + user agent for audit records. */
export async function requestContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  return { ipAddress: ip, userAgent: h.get("user-agent") };
}
