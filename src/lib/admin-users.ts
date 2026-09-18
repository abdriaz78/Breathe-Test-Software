import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { recordAudit } from "./audit";
import { isHospitalScoped } from "./rbac";
import { authorize, type CurrentUser } from "./session";

// -----------------------------------------------------------------------------
// Admin: staff account management. Admin-only (user:manage). All mutations audited.
// -----------------------------------------------------------------------------

export const createUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Valid email required").max(200),
    name: z.string().trim().min(1, "Name required").max(200),
    role: z.enum(["ADMIN", "NURSE", "PHYSICIAN", "SPECTER_SUPPORT"]),
    title: z.string().trim().max(50).optional().or(z.literal("")),
    licenseNo: z.string().trim().max(100).optional().or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    hospitalId: z.string().trim().max(64).optional().or(z.literal("")),
  })
  .refine((v) => !isHospitalScoped(v.role) || !!v.hospitalId, {
    message: "Hospital is required for Nurse and Physician accounts",
    path: ["hospitalId"],
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserProfileSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email required").max(200),
  name: z.string().trim().min(1, "Name required").max(200),
  title: z.string().trim().max(50).optional().or(z.literal("")),
  licenseNo: z.string().trim().max(100).optional().or(z.literal("")),
});
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

type Ctx = { ipAddress: string | null; userAgent: string | null };

export async function listUsers(actor: CurrentUser) {
  authorize(actor.role, "user:manage");
  return prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true, email: true, name: true, role: true, title: true,
      licenseNo: true, isActive: true, lastLoginAt: true, createdAt: true,
      hospitalId: true, hospital: { select: { name: true } },
    },
  });
}

export async function getUser(actor: CurrentUser, userId: string) {
  authorize(actor.role, "user:manage");
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, role: true, title: true,
      licenseNo: true, isActive: true, hospitalId: true,
    },
  });
}

export async function updateUserProfile(
  actor: CurrentUser,
  userId: string,
  raw: UpdateUserProfileInput,
  ctx: Ctx
) {
  authorize(actor.role, "user:manage");
  const data = updateUserProfileSchema.parse(raw);

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!target) throw new Error("User not found.");

  if (data.email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error(`A user with email "${data.email}" already exists.`);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      email: data.email,
      name: data.name,
      title: data.title || null,
      licenseNo: data.licenseNo || null,
    },
  });

  await recordAudit({
    action: "UPDATE", entity: "User", entityId: userId,
    actorId: actor.id, actorRole: actor.role,
    summary: `Updated profile for ${target.email}${data.email !== target.email ? ` (email changed to ${data.email})` : ""}`,
    ...ctx,
  });
}

export async function resetUserPassword(
  actor: CurrentUser,
  userId: string,
  raw: { password: string },
  ctx: Ctx
) {
  authorize(actor.role, "user:manage");
  const data = resetPasswordSchema.parse(raw);

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!target) throw new Error("User not found.");

  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await recordAudit({
    action: "UPDATE", entity: "User", entityId: userId,
    actorId: actor.id, actorRole: actor.role,
    summary: `Reset password for ${target.email}`,
    ...ctx,
  });
}

export async function createUser(actor: CurrentUser, raw: CreateUserInput, ctx: Ctx) {
  authorize(actor.role, "user:manage");
  const data = createUserSchema.parse(raw);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error(`A user with email "${data.email}" already exists.`);

  const hospitalId = isHospitalScoped(data.role) ? data.hospitalId || null : null;
  if (hospitalId) {
    const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital) throw new Error("Selected hospital does not exist.");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      role: data.role,
      title: data.title || null,
      licenseNo: data.licenseNo || null,
      passwordHash,
      hospitalId,
    },
  });

  await recordAudit({
    action: "CREATE", entity: "User", entityId: user.id,
    actorId: actor.id, actorRole: actor.role,
    summary: `Created user ${data.email} (${data.role})`,
    metadata: { role: data.role, hospitalId }, ...ctx,
  });
  return { id: user.id };
}

export async function changeUserHospital(
  actor: CurrentUser,
  userId: string,
  hospitalId: string | null,
  ctx: Ctx
) {
  authorize(actor.role, "user:manage");

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!target) throw new Error("User not found.");
  if (isHospitalScoped(target.role) && !hospitalId) {
    throw new Error("Nurse and Physician accounts must have a hospital assigned.");
  }
  if (hospitalId) {
    const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital) throw new Error("Selected hospital does not exist.");
  }

  await prisma.user.update({ where: { id: userId }, data: { hospitalId: hospitalId || null } });
  await recordAudit({
    action: "UPDATE", entity: "User", entityId: userId,
    actorId: actor.id, actorRole: actor.role,
    summary: `Changed hospital assignment for ${target.email}`,
    metadata: { hospitalId }, ...ctx,
  });
}

export async function setUserActive(actor: CurrentUser, userId: string, active: boolean, ctx: Ctx) {
  authorize(actor.role, "user:manage");
  if (userId === actor.id && !active) {
    throw new Error("You cannot deactivate your own account.");
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive: active },
    select: { email: true },
  });
  await recordAudit({
    action: "UPDATE", entity: "User", entityId: userId,
    actorId: actor.id, actorRole: actor.role,
    summary: `${active ? "Activated" : "Deactivated"} user ${user.email}`, ...ctx,
  });
}

export async function changeUserRole(actor: CurrentUser, userId: string, role: Role, ctx: Ctx) {
  authorize(actor.role, "user:manage");
  if (userId === actor.id && role !== "ADMIN") {
    throw new Error("You cannot remove your own admin role.");
  }
  if (isHospitalScoped(role)) {
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { hospitalId: true } });
    if (!existing?.hospitalId) {
      throw new Error("Assign a hospital to this account before making it a Nurse or Physician.");
    }
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { email: true },
  });
  await recordAudit({
    action: "UPDATE", entity: "User", entityId: userId,
    actorId: actor.id, actorRole: actor.role,
    summary: `Changed role of ${user.email} to ${role}`,
    metadata: { role }, ...ctx,
  });
}
