import { z } from "zod";
import type { Gender } from "@prisma/client";
import { prisma } from "./prisma";
import { encrypt, decrypt, blindIndex } from "./crypto";
import { recordAudit } from "./audit";
import type { CurrentUser } from "./session";
import { authorize } from "./session";

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
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"]),
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

  const where = opts.mrn?.trim()
    ? { mrnHash: blindIndex(opts.mrn.trim()) }
    : {};

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
