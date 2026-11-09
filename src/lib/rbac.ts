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
  | "timer:delete" // remove a test's sample collection reminders entirely
  | "test:diagnose" // author diagnosis/recommendation
  // Reporting / export
  | "report:export"
  | "report:share"
  // Patient portal: issue / reset / disable a patient's report-portal login
  | "portal:manage"
  // Administration
  | "user:manage"
  | "testtype:manage"
  | "hospital:manage"
  | "audit:read";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "patient:read", "patient:create", "patient:update",
    "test:read", "test:create", "test:update", "test:timer", "timer:delete",
    "report:export", "report:share", "portal:manage",
    "user:manage", "testtype:manage", "hospital:manage", "audit:read",
  ],
  NURSE: [
    "patient:read", "patient:create", "patient:update",
    "test:read", "test:create", "test:update", "test:timer",
    "report:export", "report:share", "portal:manage",
  ],
  PHYSICIAN: [
    "patient:read",
    "test:read", "test:update", "test:timer", "test:diagnose",
    "report:export", "report:share", "portal:manage",
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

/** NURSE and PHYSICIAN accounts are tied to one hospital and only ever see
 * that hospital's patients/tests/reports/staff. ADMIN and SPECTER_SUPPORT
 * are unscoped (cross-hospital) by design. */
export function isHospitalScoped(role: Role | undefined | null): boolean {
  // Fail closed: only the two explicitly cross-hospital roles are unscoped.
  // Any other value (a future role, a missing role on a malformed session)
  // is treated as scoped, so it can never fall through to "see everything".
  return !(role === "ADMIN" || role === "SPECTER_SUPPORT");
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  NURSE: "Nurse / Lab Technician",
  PHYSICIAN: "Physician",
  SPECTER_SUPPORT: "Specter Support",
};
