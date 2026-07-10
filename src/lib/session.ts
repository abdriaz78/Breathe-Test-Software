import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Role } from "@prisma/client";
import { auth } from "./auth";
import { assertCan, can, type Permission } from "./rbac";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
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
  };
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
