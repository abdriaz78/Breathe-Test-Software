import { z } from "zod";
import { prisma } from "./prisma";
import { recordAudit } from "./audit";
import { authorize, type CurrentUser } from "./session";
import { ReportLockedError } from "./samples";
import {
  computeInterpretation,
  type InterpretationRules,
} from "./interpretation";

// -----------------------------------------------------------------------------
// Report status workflow.
//
//   DRAFT ──(samples entered)──▶ IN_PROGRESS ──(sign & finalize)──▶ FINALIZED
//                                     ▲                                  │
//                                     └──────────(reopen + reason)───────┘
//
// Finalizing locks all editing and captures the physician signature plus an
// interpretation snapshot. Reopening REQUIRES a reason and is fully audited.
// The clinical diagnosis/recommendation are authored by the physician here and
// are never generated automatically.
// -----------------------------------------------------------------------------

export const diagnosisSchema = z.object({
  diagnosis: z.string().trim().max(4000).optional().or(z.literal("")),
  recommendation: z.string().trim().max(4000).optional().or(z.literal("")),
});
export type DiagnosisInput = z.infer<typeof diagnosisSchema>;

export const reopenSchema = z.object({
  reason: z.string().trim().min(5, "Please give a reason (min 5 characters).").max(1000),
});

type Ctx = { ipAddress: string | null; userAgent: string | null };

/** Save (or update) the physician's diagnosis & recommendation. Allowed while
 * the report is not finalized. Does not change status. */
export async function saveDiagnosis(
  actor: CurrentUser,
  testId: string,
  raw: DiagnosisInput,
  ctx: Ctx
): Promise<void> {
  authorize(actor.role, "test:diagnose");
  const data = diagnosisSchema.parse(raw);

  const test = await prisma.breathTest.findUnique({
    where: { id: testId },
    select: { status: true },
  });
  if (!test) throw new Error("Test not found.");
  if (test.status === "FINALIZED") throw new ReportLockedError();

  await prisma.breathTest.update({
    where: { id: testId },
    data: {
      diagnosis: data.diagnosis || null,
      recommendation: data.recommendation || null,
    },
  });

  await recordAudit({
    action: "UPDATE",
    entity: "BreathTest",
    entityId: testId,
    breathTestId: testId,
    actorId: actor.id,
    actorRole: actor.role,
    summary: "Updated diagnosis / recommendation",
    ...ctx,
  });
}

/** Sign & finalize. Persists any supplied diagnosis, captures the signature and
 * an interpretation snapshot, and locks the report. Requires a diagnosis. */
export async function finalizeReport(
  actor: CurrentUser,
  testId: string,
  raw: DiagnosisInput,
  ctx: Ctx
): Promise<void> {
  authorize(actor.role, "test:finalize");
  const data = diagnosisSchema.parse(raw);

  const test = await prisma.breathTest.findUnique({
    where: { id: testId },
    include: {
      testType: { select: { interpretationRules: true } },
      samples: { orderBy: { sampleNumber: "asc" } },
    },
  });
  if (!test) throw new Error("Test not found.");
  if (test.status === "FINALIZED") throw new Error("Report is already finalized.");

  const diagnosis = (data.diagnosis || test.diagnosis || "").trim();
  if (!diagnosis) {
    throw new Error("A diagnosis is required before finalizing the report.");
  }
  if (test.samples.length === 0) {
    throw new Error("Enter at least one sample before finalizing.");
  }

  const interpretation = computeInterpretation(
    test.samples.map((s) => ({
      timeMinutes: s.timeMinutes,
      h2Ppm: s.h2Ppm != null ? Number(s.h2Ppm) : null,
      ch4Ppm: s.ch4Ppm != null ? Number(s.ch4Ppm) : null,
      skipped: s.skipped,
    })),
    (test.testType.interpretationRules as InterpretationRules | null) ?? null
  );

  const now = new Date();
  const signatureName = `${actor.name}`.trim();

  await prisma.breathTest.update({
    where: { id: testId },
    data: {
      diagnosis,
      recommendation: (data.recommendation || test.recommendation || "").trim() || null,
      status: "FINALIZED",
      signedById: actor.id,
      signedAt: now,
      signatureName,
      finalizedAt: now,
      interpretationSnapshot: interpretation as unknown as object,
    },
  });

  await recordAudit({
    action: "FINALIZE",
    entity: "BreathTest",
    entityId: testId,
    breathTestId: testId,
    actorId: actor.id,
    actorRole: actor.role,
    summary: `Finalized & signed by ${signatureName}`,
    metadata: { previousStatus: test.status, flagCount: interpretation.flags.length },
    ...ctx,
  });
}

/** Reopen a finalized report. REQUIRES a reason (audited). Clears the signature
 * (it no longer applies) and returns the report to IN_PROGRESS. */
export async function reopenReport(
  actor: CurrentUser,
  testId: string,
  reason: string,
  ctx: Ctx
): Promise<void> {
  authorize(actor.role, "test:reopen");
  const { reason: cleanReason } = reopenSchema.parse({ reason });

  const test = await prisma.breathTest.findUnique({
    where: { id: testId },
    select: { status: true, signatureName: true },
  });
  if (!test) throw new Error("Test not found.");
  if (test.status !== "FINALIZED") {
    throw new Error("Only a finalized report can be reopened.");
  }

  await prisma.breathTest.update({
    where: { id: testId },
    data: {
      status: "IN_PROGRESS",
      signedById: null,
      signedAt: null,
      signatureName: null,
      finalizedAt: null,
    },
  });

  await recordAudit({
    action: "REOPEN",
    entity: "BreathTest",
    entityId: testId,
    breathTestId: testId,
    actorId: actor.id,
    actorRole: actor.role,
    summary: "Reopened a finalized report",
    reason: cleanReason,
    metadata: { previousSignature: test.signatureName },
    ...ctx,
  });
}

/** Audit trail for a single report, newest first. */
export async function getTestAuditTrail(actor: CurrentUser, testId: string) {
  authorize(actor.role, "test:read");
  return prisma.auditLog.findMany({
    where: { breathTestId: testId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true } } },
  });
}
