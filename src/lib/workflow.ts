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
//   DRAFT ──(samples entered)──▶ IN_PROGRESS ──(samples marked complete)──▶ FINALIZED
//
// Marking sample collection complete locks all editing and captures an
// interpretation snapshot; no physician sign-off is required. FINALIZED is
// terminal — there is no reopen path. The clinical diagnosis/recommendation
// are physician-authored free-form notes and are never generated automatically.
// -----------------------------------------------------------------------------

export const diagnosisSchema = z.object({
  diagnosis: z.string().trim().max(4000).optional().or(z.literal("")),
  recommendation: z.string().trim().max(4000).optional().or(z.literal("")),
});
export type DiagnosisInput = z.infer<typeof diagnosisSchema>;

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

/** Mark sample collection complete (nurse/tech action). Locks the report and
 * captures an interpretation snapshot — no physician sign-off is required. */
export async function completeSampleCollection(
  actor: CurrentUser,
  testId: string,
  ctx: Ctx
): Promise<void> {
  authorize(actor.role, "test:update");

  const test = await prisma.breathTest.findUnique({
    where: { id: testId },
    include: {
      testType: { select: { interpretationRules: true } },
      samples: { orderBy: { sampleNumber: "asc" } },
    },
  });
  if (!test) throw new Error("Test not found.");
  if (test.status === "FINALIZED") throw new Error("Report is already finalized.");
  if (test.samples.length === 0) {
    throw new Error("Enter at least one sample before marking collection complete.");
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

  await prisma.breathTest.update({
    where: { id: testId },
    data: {
      status: "FINALIZED",
      finalizedAt: now,
      timerEndedAt: test.timerEndedAt ?? (test.timerStartedAt ? now : null),
      interpretationSnapshot: interpretation as unknown as object,
    },
  });

  await recordAudit({
    action: "STATUS_CHANGE",
    entity: "BreathTest",
    entityId: testId,
    breathTestId: testId,
    actorId: actor.id,
    actorRole: actor.role,
    summary: "Marked sample collection complete",
    metadata: { previousStatus: test.status, flagCount: interpretation.flags.length },
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
