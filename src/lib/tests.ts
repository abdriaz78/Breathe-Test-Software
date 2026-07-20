import { z } from "zod";
import type { ReportStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import { recordAudit } from "./audit";
import type { CurrentUser } from "./session";
import { authorize } from "./session";

// -----------------------------------------------------------------------------
// Breath-test data-access layer. Creating a test starts the DRAFT lifecycle.
// Patient name is decrypted here for display; test setup fields carry no PHI.
// -----------------------------------------------------------------------------

// Accept a date string (from a form) OR a Date (already-parsed input), so the
// schema is idempotent — createTest re-parses its input and must not reject a
// value it produced on a previous parse.
const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .transform((v) => {
    if (v == null || v === "") return undefined;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  });

export const testInputSchema = z.object({
  patientId: z.string().trim().min(1, "Patient is required"),
  testTypeId: z.string().trim().min(1, "Test type is required"),
  departmentId: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : undefined)),
  substrate: z.string().trim().max(200).optional().or(z.literal("")),
  dose: z.string().trim().max(200).optional().or(z.literal("")),
  collectionDate: optionalDate,
  analysisDate: optionalDate,
  technicianId: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : undefined)),
  preTestSymptoms: z.string().trim().max(2000).optional().or(z.literal("")),
  preTestNotes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type TestInput = z.infer<typeof testInputSchema>;

export async function createTest(
  actor: CurrentUser,
  raw: TestInput,
  ctx: { ipAddress: string | null; userAgent: string | null }
): Promise<{ id: string }> {
  authorize(actor.role, "test:create");
  const data = testInputSchema.parse(raw);

  // Validate the patient exists (and capture MRN for the audit summary).
  const patient = await prisma.patient.findUnique({
    where: { id: data.patientId },
    select: { id: true, mrn: true },
  });
  if (!patient) throw new Error("Selected patient does not exist.");

  const test = await prisma.breathTest.create({
    data: {
      patientId: data.patientId,
      testTypeId: data.testTypeId,
      departmentId: data.departmentId ?? null,
      substrate: data.substrate || null,
      dose: data.dose || null,
      collectionDate: data.collectionDate ?? null,
      analysisDate: data.analysisDate ?? null,
      technicianId: data.technicianId ?? null,
      preTestSymptoms: data.preTestSymptoms || null,
      preTestNotes: data.preTestNotes || null,
      status: "DRAFT",
      createdById: actor.id,
    },
  });

  await recordAudit({
    action: "CREATE",
    entity: "BreathTest",
    entityId: test.id,
    breathTestId: test.id,
    actorId: actor.id,
    actorRole: actor.role,
    summary: `Created breath test for patient MRN ${patient.mrn}`,
    metadata: { patientId: patient.id, testTypeId: data.testTypeId, status: "DRAFT" },
    ...ctx,
  });

  return { id: test.id };
}

export interface TestListItem {
  id: string;
  patientName: string;
  patientMrn: string;
  testTypeName: string;
  status: ReportStatus;
  collectionDate: Date | null;
  createdAt: Date;
}

export async function listTests(
  actor: CurrentUser,
  opts: { patientId?: string; status?: ReportStatus } = {}
): Promise<TestListItem[]> {
  authorize(actor.role, "test:read");

  const rows = await prisma.breathTest.findMany({
    where: {
      patientId: opts.patientId,
      status: opts.status,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      patient: { select: { mrn: true, nameEnc: true } },
      testType: { select: { name: true } },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    patientName: decrypt(t.patient.nameEnc) ?? "—",
    patientMrn: t.patient.mrn,
    testTypeName: t.testType.name,
    status: t.status,
    collectionDate: t.collectionDate,
    createdAt: t.createdAt,
  }));
}

/** Full test with resolved names for the detail view. Patient name is PHI, so
 * we audit a VIEW_PHI when the caller loads a test detail. */
export async function getTestDetail(
  actor: CurrentUser,
  id: string,
  ctx: { ipAddress: string | null; userAgent: string | null }
) {
  authorize(actor.role, "test:read");

  const t = await prisma.breathTest.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, mrn: true, nameEnc: true, dobEnc: true, gender: true, weightKg: true } },
      testType: { select: { name: true, key: true, interpretationRules: true } },
      department: { select: { name: true } },
      technician: { select: { name: true, title: true } },
      createdBy: { select: { name: true } },
      signedBy: { select: { name: true, title: true } },
      samples: { orderBy: { sampleNumber: "asc" } },
    },
  });
  if (!t) return null;

  await recordAudit({
    action: "VIEW_PHI",
    entity: "BreathTest",
    entityId: t.id,
    breathTestId: t.id,
    actorId: actor.id,
    actorRole: actor.role,
    summary: `Viewed breath test (patient MRN ${t.patient.mrn})`,
    ...ctx,
  });

  return {
    id: t.id,
    status: t.status,
    substrate: t.substrate,
    dose: t.dose,
    collectionDate: t.collectionDate,
    analysisDate: t.analysisDate,
    preTestSymptoms: t.preTestSymptoms,
    preTestNotes: t.preTestNotes,
    diagnosis: t.diagnosis,
    recommendation: t.recommendation,
    signedAt: t.signedAt,
    signatureName: t.signatureName,
    finalizedAt: t.finalizedAt,
    createdAt: t.createdAt,
    timer: {
      startedAt: t.timerStartedAt,
      intervalMinutes: t.timerIntervalMin,
      totalSamples: t.timerTotalSamples,
      ackedIndex: t.timerAckedIndex,
      endedAt: t.timerEndedAt,
    },
    patient: {
      id: t.patient.id,
      mrn: t.patient.mrn,
      name: decrypt(t.patient.nameEnc) ?? "—",
      dob: decrypt(t.patient.dobEnc) ?? "",
      gender: t.patient.gender,
      weightKg: t.patient.weightKg ? Number(t.patient.weightKg) : null,
    },
    testType: t.testType,
    departmentName: t.department?.name ?? null,
    technician: t.technician,
    createdByName: t.createdBy.name,
    signedBy: t.signedBy,
    samples: t.samples,
  };
}

export interface TestExportRow {
  id: string;
  mrn: string;
  patientName: string;
  testType: string;
  status: ReportStatus;
  collectionDate: Date | null;
  analysisDate: Date | null;
  sampleCount: number;
  signedBy: string | null;
  createdAt: Date;
}

/** Flat rows for a tests summary CSV export. */
export async function listTestsForExport(
  actor: CurrentUser,
  opts: { status?: ReportStatus } = {}
): Promise<TestExportRow[]> {
  authorize(actor.role, "report:export");
  const rows = await prisma.breathTest.findMany({
    where: { status: opts.status },
    orderBy: { createdAt: "desc" },
    take: 2000,
    include: {
      patient: { select: { mrn: true, nameEnc: true } },
      testType: { select: { name: true } },
      _count: { select: { samples: true } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    mrn: t.patient.mrn,
    patientName: decrypt(t.patient.nameEnc) ?? "—",
    testType: t.testType.name,
    status: t.status,
    collectionDate: t.collectionDate,
    analysisDate: t.analysisDate,
    sampleCount: t._count.samples,
    signedBy: t.signatureName,
    createdAt: t.createdAt,
  }));
}

export const STATUS_LABEL: Record<ReportStatus, string> = {
  DRAFT: "Draft",
  IN_PROGRESS: "In Progress",
  FINALIZED: "Finalized",
};

export const STATUS_STYLE: Record<ReportStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  FINALIZED: "bg-emerald-100 text-emerald-800",
};
