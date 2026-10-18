import { z } from "zod";
import { prisma } from "./prisma";
import { recordAudit } from "./audit";
import { authorize, type CurrentUser } from "./session";

// -----------------------------------------------------------------------------
// Admin: hospitals & departments. Permission: hospital:manage (ADMIN, Support).
// -----------------------------------------------------------------------------

export const hospitalSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(200),
  code: z.string().trim().max(50).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
});
export type HospitalInput = z.infer<typeof hospitalSchema>;

export const departmentSchema = z.object({
  hospitalId: z.string().trim().min(1),
  name: z.string().trim().min(1, "Department name required").max(120),
});

type Ctx = { ipAddress: string | null; userAgent: string | null };

export async function listHospitals(actor: CurrentUser) {
  authorize(actor.role, "hospital:manage");
  return prisma.hospital.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      departments: { orderBy: { name: "asc" } },
      _count: { select: { patients: true, users: true } },
    },
  });
}

export async function createHospital(actor: CurrentUser, raw: HospitalInput, ctx: Ctx) {
  authorize(actor.role, "hospital:manage");
  const data = hospitalSchema.parse(raw);

  if (data.code) {
    const existing = await prisma.hospital.findUnique({ where: { code: data.code } });
    if (existing) throw new Error(`A hospital with code "${data.code}" already exists.`);
  }

  const h = await prisma.hospital.create({
    data: {
      name: data.name,
      code: data.code || null,
      city: data.city || null,
      country: data.country || "United Arab Emirates",
    },
  });
  await recordAudit({
    action: "CREATE", entity: "Hospital", entityId: h.id,
    actorId: actor.id, actorRole: actor.role,
    summary: `Created hospital "${data.name}"`, ...ctx,
  });
  return { id: h.id };
}

export async function updateHospital(actor: CurrentUser, hospitalId: string, raw: HospitalInput, ctx: Ctx) {
  authorize(actor.role, "hospital:manage");
  if (!hospitalId) throw new Error("Hospital is required.");
  const data = hospitalSchema.parse(raw);

  const before = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!before) throw new Error("Hospital not found.");

  if (data.code && data.code !== before.code) {
    const existing = await prisma.hospital.findUnique({ where: { code: data.code } });
    if (existing && existing.id !== hospitalId) {
      throw new Error(`A hospital with code "${data.code}" already exists.`);
    }
  }

  const next = {
    name: data.name,
    code: data.code || null,
    city: data.city || null,
    country: data.country || "United Arab Emirates",
  };
  const changed = (Object.keys(next) as Array<keyof typeof next>).filter((k) => before[k] !== next[k]);
  if (changed.length === 0) return { id: hospitalId };

  await prisma.hospital.update({ where: { id: hospitalId }, data: next });
  await recordAudit({
    action: "UPDATE", entity: "Hospital", entityId: hospitalId,
    actorId: actor.id, actorRole: actor.role,
    summary: `Updated hospital "${next.name}"`,
    metadata: {
      changed,
      before: Object.fromEntries(changed.map((k) => [k, before[k]])),
      after: Object.fromEntries(changed.map((k) => [k, next[k]])),
    },
    ...ctx,
  });
  return { id: hospitalId };
}

/**
 * Permanently delete a hospital and its departments. Refused while any patient
 * or staff account still belongs to it — clinical records are never removed as
 * a side effect; move or remove them first.
 */
export async function deleteHospital(actor: CurrentUser, hospitalId: string, ctx: Ctx) {
  authorize(actor.role, "hospital:manage");
  if (!hospitalId) throw new Error("Hospital is required.");

  const h = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    include: { _count: { select: { patients: true, users: true, departments: true } } },
  });
  if (!h) throw new Error("Hospital not found.");
  if (h._count.patients > 0) {
    throw new Error(
      `"${h.name}" still has ${h._count.patients} patient(s). Hospitals with patient records cannot be deleted.`
    );
  }
  if (h._count.users > 0) {
    throw new Error(
      `"${h.name}" still has ${h._count.users} staff account(s) assigned. Reassign them to another hospital first.`
    );
  }

  // Departments cascade (schema: onDelete: Cascade).
  await prisma.hospital.delete({ where: { id: hospitalId } });
  await recordAudit({
    action: "DELETE", entity: "Hospital", entityId: hospitalId,
    actorId: actor.id, actorRole: actor.role,
    summary: `Deleted hospital "${h.name}"`,
    metadata: { code: h.code, departmentsDeleted: h._count.departments },
    ...ctx,
  });
}

// Logo is stored inline as a base64 data URI in Hospital.logoUrl (no external
// file storage needed). Cap the size so DB rows and PDFs stay reasonable.
const MAX_LOGO_CHARS = 800_000; // ~500 KB image once base64-encoded

export async function setHospitalLogo(
  actor: CurrentUser,
  hospitalId: string,
  dataUri: string | null,
  ctx: Ctx
) {
  authorize(actor.role, "hospital:manage");
  if (!hospitalId) throw new Error("Hospital is required.");

  let value: string | null = null;
  const trimmed = dataUri?.trim();
  if (trimmed) {
    if (!/^data:image\/(png|jpeg);base64,/.test(trimmed)) {
      throw new Error("Logo must be a PNG or JPG image.");
    }
    if (trimmed.length > MAX_LOGO_CHARS) {
      throw new Error("Logo image is too large. Please use an image under 500 KB.");
    }
    value = trimmed;
  }

  const h = await prisma.hospital.update({
    where: { id: hospitalId },
    data: { logoUrl: value },
  });
  await recordAudit({
    action: "UPDATE", entity: "Hospital", entityId: h.id,
    actorId: actor.id, actorRole: actor.role,
    summary: value ? `Updated logo for "${h.name}"` : `Removed logo for "${h.name}"`,
    ...ctx,
  });
  return { id: h.id };
}

export async function addDepartment(actor: CurrentUser, hospitalId: string, name: string, ctx: Ctx) {
  authorize(actor.role, "hospital:manage");
  const data = departmentSchema.parse({ hospitalId, name });

  const existing = await prisma.department.findUnique({
    where: { hospitalId_name: { hospitalId: data.hospitalId, name: data.name } },
  });
  if (existing) throw new Error(`Department "${data.name}" already exists for this hospital.`);

  const d = await prisma.department.create({
    data: { hospitalId: data.hospitalId, name: data.name },
  });
  await recordAudit({
    action: "CREATE", entity: "Department", entityId: d.id,
    actorId: actor.id, actorRole: actor.role,
    summary: `Added department "${data.name}"`,
    metadata: { hospitalId: data.hospitalId }, ...ctx,
  });
  return { id: d.id };
}
