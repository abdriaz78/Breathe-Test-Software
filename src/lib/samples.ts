import { z } from "zod";
import { prisma } from "./prisma";
import { recordAudit } from "./audit";
import type { CurrentUser } from "./session";
import { authorize } from "./session";

export { sampleTotal } from "./sample-math";

// -----------------------------------------------------------------------------
// Sample entry. Samples belong to a BreathTest and can only be edited while the
// report is NOT finalized. H2+CH4 is derived in the app (see sampleTotal), never
// stored, to avoid drift.
// -----------------------------------------------------------------------------

// Accept "" / null / number for optional numeric fields.
const optNumber = z
  .union([z.coerce.number(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v == null || !Number.isNaN(v), "Must be a number");

export const sampleRowSchema = z
  .object({
    sampleNumber: z.coerce.number().int().min(0, "Sample # must be ≥ 0"),
    timeMinutes: z.coerce.number().int("Time must be whole minutes"),
    h2Ppm: optNumber,
    ch4Ppm: optNumber,
    co2Percent: optNumber,
    correctionFactor: optNumber,
    // .nullish() = accepts string | null | undefined; the DB columns are nullable
    // and empty rows send null, so null must be allowed (not just undefined).
    symptoms: z.string().trim().max(500).nullish().transform((v) => v || null),
    skipped: z.coerce.boolean().optional().default(false),
    skippedReason: z.string().trim().max(500).nullish().transform((v) => v || null),
  })
  .refine((r) => !r.skipped || (r.skippedReason && r.skippedReason.length > 0), {
    message: "A reason is required for a skipped sample",
    path: ["skippedReason"],
  });

export const saveSamplesSchema = z.object({
  rows: z.array(sampleRowSchema).max(200),
});

export type SampleRowInput = z.infer<typeof sampleRowSchema>;

export class ReportLockedError extends Error {
  constructor() {
    super("This report is finalized and locked. Reopen it before editing samples.");
    this.name = "ReportLockedError";
  }
}

export async function saveSamples(
  actor: CurrentUser,
  testId: string,
  rows: SampleRowInput[],
  ctx: { ipAddress: string | null; userAgent: string | null }
): Promise<{ count: number }> {
  authorize(actor.role, "test:update");

  const test = await prisma.breathTest.findUnique({
    where: { id: testId },
    select: { id: true, status: true },
  });
  if (!test) throw new Error("Test not found.");
  if (test.status === "FINALIZED") throw new ReportLockedError();

  const parsed = saveSamplesSchema.parse({ rows });

  // Enforce unique sample numbers within the submission.
  const seen = new Set<number>();
  for (const r of parsed.rows) {
    if (seen.has(r.sampleNumber)) {
      throw new Error(`Duplicate sample number ${r.sampleNumber}.`);
    }
    seen.add(r.sampleNumber);
  }

  // Replace the sample set atomically. Bump DRAFT -> IN_PROGRESS on first data.
  await prisma.$transaction(async (tx) => {
    await tx.sample.deleteMany({ where: { testId } });
    if (parsed.rows.length) {
      await tx.sample.createMany({
        data: parsed.rows.map((r) => ({
          testId,
          sampleNumber: r.sampleNumber,
          timeMinutes: r.timeMinutes,
          h2Ppm: r.h2Ppm,
          ch4Ppm: r.ch4Ppm,
          co2Percent: r.co2Percent,
          correctionFactor: r.correctionFactor,
          symptoms: r.symptoms,
          skipped: r.skipped,
          skippedReason: r.skipped ? r.skippedReason : null,
        })),
      });
    }
    if (test.status === "DRAFT" && parsed.rows.length > 0) {
      await tx.breathTest.update({
        where: { id: testId },
        data: { status: "IN_PROGRESS" },
      });
    }
  });

  await recordAudit({
    action: "UPDATE",
    entity: "BreathTest",
    entityId: testId,
    breathTestId: testId,
    actorId: actor.id,
    actorRole: actor.role,
    summary: `Saved ${parsed.rows.length} sample(s)`,
    metadata: { sampleCount: parsed.rows.length, previousStatus: test.status },
    ...ctx,
  });

  return { count: parsed.rows.length };
}
