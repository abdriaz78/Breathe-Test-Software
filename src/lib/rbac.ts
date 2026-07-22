import type { Role } from "@prisma/client";

// -----------------------------------------------------------------------------
// Role-based access control.
//
// Permissions are coarse-grained capability strings. `ROLE_PERMISSIONS` maps each
// role to the capabilities it holds. UI and API both consult `can()`.
// -----------------------------------------------------------------------------

export type Permission =
  // Patients
  | "patient:read"
  | "patient:create"
  | "patient:update"
  // Tests & samples
  | "test:read"
  | "test:create"
  | "test:update" // edit setup/samples while not finalized
  | "test:timer" // start / acknowledge the sample collection timer
  | "test:diagnose" // author diagnosis/recommendation
  // Reporting / export
  | "report:export"
  | "report:share"
  // Administration
  | "user:manage"
  | "testtype:manage"
  | "hospital:manage"
  | "audit:read";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "patient:read", "patient:create", "patient:update",
    "test:read", "test:create", "test:update", "test:timer",
    "report:export", "report:share",
    "user:manage", "testtype:manage", "hospital:manage", "audit:read",
  ],
  NURSE: [
    "patient:read", "patient:create", "patient:update",
    "test:read", "test:create", "test:update", "test:timer",
    "report:export", "report:share",
  ],
  PHYSICIAN: [
    "patient:read",
    "test:read", "test:update", "test:timer", "test:diagnose",
    "report:export", "report:share",
    "audit:read",
  ],
  SPECTER_SUPPORT: [
    "patient:read",
    "test:read",
    "testtype:manage", "hospital:manage", "audit:read",
  ],
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Throws if the role lacks the permission. Use to guard server actions/APIs. */
export function assertCan(role: Role | undefined | null, permission: Permission): void {
  if (!can(role, permission)) {
    const err = new Error(`Forbidden: role ${role ?? "anonymous"} lacks ${permission}`);
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  NURSE: "Nurse / Lab Technician",
  PHYSICIAN: "Physician",
  SPECTER_SUPPORT: "Specter Support",
};
