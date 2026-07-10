import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { recordAudit } from "./audit";
import { authorize, type CurrentUser } from "./session";

// -----------------------------------------------------------------------------
// Admin: staff account management. Admin-only (user:manage). All mutations audited.
// -----------------------------------------------------------------------------

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email required").max(200),
  name: z.string().trim().min(1, "Name required").max(200),
  role: z.enum(["ADMIN", "NURSE", "PHYSICIAN", "SPECTER_SUPPORT"]),
  title: z.string().trim().max(50).optional().or(z.literal("")),
  licenseNo: z.string().trim().max(100).optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

type Ctx = { ipAddress: string | null; userAgent: string | null };

export async function listUsers(actor: CurrentUser) {
  authorize(actor.role, "user:manage");
  return prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true, email: true, name: true, role: true, title: true,
      licenseNo: true, isActive: true, lastLoginAt: true, createdAt: true,
    },
  });
}

export async function createUser(actor: CurrentUser, raw: CreateUserInput, ctx: Ctx) {
  authorize(actor.role, "user:manage");
  const data = createUserSchema.parse(raw);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error(`A user with email "${data.email}" already exists.`);

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      role: data.role,
      title: data.title || null,
      licenseNo: data.licenseNo || null,
      passwordHash,
    },
  });

  await recordAudit({
    action: "CREATE", entity: "User", entityId: user.id,
    actorId: actor.id, actorRole: actor.role,
    summary: `Created user ${data.email} (${data.role})`,
    metadata: { role: data.role }, ...ctx,
  });
  return { id: user.id };
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
