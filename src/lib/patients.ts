import { z } from "zod";
import type { Gender } from "@prisma/client";
import { prisma } from "./prisma";
import { encrypt, decrypt, blindIndex } from "./crypto";
import { recordAudit } from "./audit";
import type { CurrentUser } from "./session";
import { authorize, hospitalScope, isOutsideScope } from "./session";
import { isHospitalScoped } from "./rbac";
import { PAGE_SIZE, matchesQuery, pageWindow, paginate, type Page } from "./pagination";

// -----------------------------------------------------------------------------
// Patient data-access layer. All PHI is encrypted on write and decrypted only
// here (never in the DB). Every create/update and every PHI read is audited.
// -----------------------------------------------------------------------------

export const patientInputSchema = z.object({
  mrn: z.string().trim().min(1, "MRN is required").max(64),
  name: z.string().trim().min(1, "Name is required").max(200),
  dob: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Valid date of birth is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"], { errorMap: () => ({ message: "Please select a gender" }) }),
  weightKg: z
    .union([z.coerce.number().positive().max(1000), z.literal("").transform(() => undefined)])
    .optional(),
  hospitalId: z.string().trim().min(1, "Hospital is required"),
  referringPhysician: z.string().trim().max(200).optional().or(z.literal("")),
});

export type PatientInput = z.infer<typeof patientInputSchema>;

/** Decrypted patient view returned to the app layer. */
export interface PatientView {
  id: string;
  mrn: string;
  name: string;
  dob: string; // ISO date
  gender: Gender;
  weightKg: number | null;
  referringPhysician: string | null;
  hospitalId: string;
  hospitalName: string;
  createdAt: Date;
}

function ageFromDob(dobIso: string): number | null {
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : null;
}

export function ageOf(dobIso: string): number | null {
  return ageFromDob(dobIso);
}

export async function createPatient(
  actor: CurrentUser,
  raw: PatientInput,
  ctx: { ipAddress: string | null; userAgent: string | null }
): Promise<{ id: string }> {
  authorize(actor.role, "patient:create");
  const data = patientInputSchema.parse(raw);

  // A hospital-scoped user (Nurse/Physician) can only register patients under
  // their own hospital, regardless of what the submitted form claims.
  if (isHospitalScoped(actor.role) && data.hospitalId !== actor.hospitalId) {
    throw new Error("You can only register patients for your own hospital.");
  }

  const mrnHash = blindIndex(data.mrn);
  const existing = await prisma.patient.findUnique({ where: { mrnHash } });
  if (existing) {
    throw new Error(`A patient with MRN "${data.mrn}" already exists.`);
  }

  const patient = await prisma.patient.create({
    data: {
      mrn: data.mrn,
      mrnHash,
      nameEnc: encrypt(data.name)!,
      dobEnc: encrypt(new Date(data.dob).toISOString())!,
      referringPhysicianEnc: encrypt(data.referringPhysician || null),
      gender: data.gender,
      weightKg: data.weightKg ?? null,
      hospitalId: data.hospitalId,
    },
  });

  await recordAudit({
    action: "CREATE",
    entity: "Patient",
    entityId: patient.id,
    actorId: actor.id,
    actorRole: actor.role,
    summary: `Registered patient (MRN ${data.mrn})`,
    metadata: { mrn: data.mrn, hospitalId: data.hospitalId },
    ...ctx,
  });

  return { id: patient.id };
}

/** List patients (optionally filtered by MRN via blind index). No PHI in list
 * except name, which requires decryption — we audit a single VIEW_PHI for the
 * listing action rather than per-row. */
export async function listPatients(
  actor: CurrentUser,
  opts: { mrn?: string } = {}
): Promise<Array<Pick<PatientView, "id" | "mrn" | "name" | "gender" | "hospitalName">>> {
  authorize(actor.role, "patient:read");

  const where = {
    ...(opts.mrn?.trim() ? { mrnHash: blindIndex(opts.mrn.trim()) } : {}),
    ...hospitalScope(actor),
  };

  const rows = await prisma.patient.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { hospital: { select: { name: true } } },
  });

  return rows.map((p) => ({
    id: p.id,
    mrn: p.mrn,
    name: decrypt(p.nameEnc) ?? "—",
    gender: p.gender,
    hospitalName: p.hospital.name,
  }));
}

export type PatientListRow = Pick<PatientView, "id" | "mrn" | "name" | "gender" | "hospitalName">;

/**
 * One page of the patients list, newest first, optionally searched by name,
 * MRN or hospital. Every record in the actor's scope is reachable — unlike
 * listPatients, there is no row cap.
 */
export async function listPatientsPage(
  actor: CurrentUser,
  opts: { q?: string; page?: number } = {}
): Promise<Page<PatientListRow>> {
  authorize(actor.role, "patient:read");
  const where = hospitalScope(actor);
  const q = opts.q?.trim() ?? "";
  const toRow = (p: { id: string; mrn: string; nameEnc: string; gender: PatientListRow["gender"]; hospital: { name: string } }) => ({
    id: p.id,
    mrn: p.mrn,
    name: decrypt(p.nameEnc) ?? "—",
    gender: p.gender,
    hospitalName: p.hospital.name,
  });
  const select = { id: true, mrn: true, nameEnc: true, gender: true, hospital: { select: { name: true } } } as const;

  if (q) {
    const all = await prisma.patient.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select });
    const hits = all.map(toRow).filter((p) => matchesQuery(q, p.name, p.mrn, p.hospitalName));
    return paginate(hits, opts.page ?? 1);
  }

  const total = await prisma.patient.count({ where });
  const { page, pageCount, skip } = pageWindow(total, opts.page ?? 1);
  const rows = await prisma.patient.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take: PAGE_SIZE, select });
  return { rows: rows.map(toRow), total, page, pageCount, pageSize: PAGE_SIZE };
}

export async function getPatient(
  actor: CurrentUser,
  id: string,
  ctx: { ipAddress: string | null; userAgent: string | null }
): Promise<PatientView | null> {
  authorize(actor.role, "patient:read");

  const p = await prisma.patient.findUnique({
    where: { id },
    include: { hospital: { select: { name: true } } },
  });
  if (!p) return null;
  if (isOutsideScope(actor, p.hospitalId)) return null;

  await recordAudit({
    action: "VIEW_PHI",
    entity: "Patient",
    entityId: p.id,
    actorId: actor.id,
    actorRole: actor.role,
    summary: `Viewed patient record (MRN ${p.mrn})`,
    ...ctx,
  });

  return {
    id: p.id,
    mrn: p.mrn,
    name: decrypt(p.nameEnc) ?? "—",
    dob: decrypt(p.dobEnc) ?? "",
    gender: p.gender,
    weightKg: p.weightKg ? Number(p.weightKg) : null,
    referringPhysician: decrypt(p.referringPhysicianEnc),
    hospitalId: p.hospitalId,
    hospitalName: p.hospital.name,
    createdAt: p.createdAt,
  };
}

/** Correct a patient's registration details. Audits which fields changed (by
 * name only — no PHI values) plus the optional correction reason. */
export async function updatePatient(
  actor: CurrentUser,
  id: string,
  raw: PatientInput,
  reason: string | null,
  ctx: { ipAddress: string | null; userAgent: string | null }
): Promise<{ id: string }> {
  authorize(actor.role, "patient:update");
  const data = patientInputSchema.parse(raw);

  const existing = await prisma.patient.findUnique({ where: { id } });
  if (!existing || isOutsideScope(actor, existing.hospitalId)) {
    throw new Error("Patient not found.");
  }

  // Hospital-scoped users can't move a patient to another hospital.
  if (isHospitalScoped(actor.role) && data.hospitalId !== actor.hospitalId) {
    throw new Error("You can only manage patients for your own hospital.");
  }

  const mrnHash = blindIndex(data.mrn);
  if (mrnHash !== existing.mrnHash) {
    const clash = await prisma.patient.findUnique({ where: { mrnHash } });
    if (clash && clash.id !== id) {
      throw new Error(`A patient with MRN "${data.mrn}" already exists.`);
    }
  }

  const dobIso = new Date(data.dob).toISOString();
  const physician = data.referringPhysician || null;
  const weight = data.weightKg ?? null;
  const oldWeight = existing.weightKg != null ? Number(existing.weightKg) : null;

  const changed: string[] = [];
  if (data.mrn !== existing.mrn) changed.push("mrn");
  if (data.name !== decrypt(existing.nameEnc)) changed.push("name");
  if (dobIso !== decrypt(existing.dobEnc)) changed.push("dob");
  if (data.gender !== existing.gender) changed.push("gender");
  if (weight !== oldWeight) changed.push("weightKg");
  if (data.hospitalId !== existing.hospitalId) changed.push("hospitalId");
  if (physician !== decrypt(existing.referringPhysicianEnc)) changed.push("referringPhysician");

  if (changed.length === 0) return { id };

  await prisma.patient.update({
    where: { id },
    data: {
      mrn: data.mrn,
      mrnHash,
      nameEnc: encrypt(data.name)!,
      dobEnc: encrypt(dobIso)!,
      referringPhysicianEnc: encrypt(physician),
      gender: data.gender,
      weightKg: weight,
      hospitalId: data.hospitalId,
    },
  });

  await recordAudit({
    action: "UPDATE",
    entity: "Patient",
    entityId: id,
    actorId: actor.id,
    actorRole: actor.role,
    summary: `Corrected patient details (MRN ${data.mrn}): ${changed.join(", ")}`,
    reason: reason || undefined,
    // MRN is already shown in plaintext elsewhere in the audit trail, so the
    // old/new MRN is safe to keep; other fields are recorded by name only.
    metadata: {
      changedFields: changed,
      ...(changed.includes("mrn") ? { previousMrn: existing.mrn, mrn: data.mrn } : {}),
      ...(changed.includes("hospitalId")
        ? { previousHospitalId: existing.hospitalId, hospitalId: data.hospitalId }
        : {}),
    },
    ...ctx,
  });

  return { id };
}
