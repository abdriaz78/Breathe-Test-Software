import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import { recordAudit } from "./audit";
import type { CurrentUser } from "./session";
import { authorize } from "./session";
import { ReportLockedError } from "./samples";

// -----------------------------------------------------------------------------
// Sample collection timer.
//
// A breath test collects samples on a fixed cadence (typically every 30 min).
// A nurse presses "Start collection" once; from then on the due time of every
// remaining sample is DERIVED, never stored:
//
//     dueAt(n) = timerStartedAt + n * timerIntervalMin minutes   (n = 1..total-1)
//
// so there is nothing to drift out of sync (same rationale as H2+CH4 in
// src/lib/samples.ts). Acknowledging a due sample bumps timerAckedIndex, which
// arms the next interval. Because the anchor lives in Postgres, every user on
// every device sees the same countdown and it survives a reload.
//
// Sample indexes are 0-based: index 0 is the baseline taken at start, so the
// first countdown targets index 1.
// -----------------------------------------------------------------------------

type Ctx = { ipAddress: string | null; userAgent: string | null };

export const MAX_ACTIVE_TIMERS = 50;

export const startTimerSchema = z.object({
  intervalMinutes: z.coerce
    .number()
    .int("Interval must be whole minutes")
    .min(1, "Interval must be at least 1 minute")
    .max(240, "Interval must be 240 minutes or less"),
  totalSamples: z.coerce
    .number()
    .int()
    .min(2, "Plan at least 2 samples (baseline + 1)")
    .max(50, "Plan 50 samples or fewer"),
});
export type StartTimerInput = z.infer<typeof startTimerSchema>;

export interface ActiveTimer {
  testId: string;
  patientName: string;
  patientMrn: string;
  testTypeName: string;
  startedAt: string; // ISO
  intervalMinutes: number;
  totalSamples: number;
  nextSampleIndex: number;
  nextDueAt: string; // ISO
  isDue: boolean;
}

/** Absolute due time of sample `index`, counting from the timer anchor. */
export function dueAt(startedAt: Date, intervalMinutes: number, index: number): Date {
  return new Date(startedAt.getTime() + index * intervalMinutes * 60_000);
}

/**
 * Every timer that is still counting down, for the header widget.
 *
 * Deliberately does NOT record an audit entry: this is polled every ~30s by
 * every open tab and would swamp AuditLog. Viewing a test's PHI is already
 * audited by getTestDetail (src/lib/tests.ts).
 */
export async function listActiveTimers(actor: CurrentUser): Promise<ActiveTimer[]> {
  authorize(actor.role, "test:read");

  const rows = await prisma.breathTest.findMany({
    where: {
      status: { not: "FINALIZED" },
      timerStartedAt: { not: null },
      timerEndedAt: null,
    },
    orderBy: { timerStartedAt: "asc" },
    take: MAX_ACTIVE_TIMERS,
    select: {
      id: true,
      timerStartedAt: true,
      timerIntervalMin: true,
      timerTotalSamples: true,
      timerAckedIndex: true,
      patient: { select: { mrn: true, nameEnc: true } },
      testType: { select: { name: true } },
    },
  });

  const now = Date.now();
  const timers: ActiveTimer[] = [];

  for (const t of rows) {
    if (!t.timerStartedAt) continue;
    const total = t.timerTotalSamples ?? 0;
    const nextIndex = t.timerAckedIndex + 1;
    // Every planned sample has been acknowledged — nothing left to count down.
    if (nextIndex >= total) continue;

    const due = dueAt(t.timerStartedAt, t.timerIntervalMin, nextIndex);
    timers.push({
      testId: t.id,
      patientName: decrypt(t.patient.nameEnc) ?? "—",
      patientMrn: t.patient.mrn,
      testTypeName: t.testType.name,
      startedAt: t.timerStartedAt.toISOString(),
      intervalMinutes: t.timerIntervalMin,
      totalSamples: total,
      nextSampleIndex: nextIndex,
      nextDueAt: due.toISOString(),
      isDue: due.getTime() <= now,
    });
  }

  // Soonest due first, so the header can show the most urgent timer.
  timers.sort((a, b) => a.nextDueAt.localeCompare(b.nextDueAt));
  return timers;
}

/** Start the collection timer. Also bumps DRAFT -> IN_PROGRESS. */
export async function startTimer(
  actor: CurrentUser,
  testId: string,
  raw: StartTimerInput,
  ctx: Ctx
): Promise<void> {
  authorize(actor.role, "test:timer");
  const data = startTimerSchema.parse(raw);

  const test = await prisma.breathTest.findUnique({
    where: { id: testId },
    select: { status: true, timerStartedAt: true, timerEndedAt: true },
  });
  if (!test) throw new Error("Test not found.");
  if (test.status === "FINALIZED") throw new ReportLockedError();
  if (test.timerStartedAt && !test.timerEndedAt) {
    throw new Error("A collection timer is already running for this test.");
  }

  await prisma.breathTest.update({
    where: { id: testId },
    data: {
      timerStartedAt: new Date(),
      timerIntervalMin: data.intervalMinutes,
      timerTotalSamples: data.totalSamples,
      timerAckedIndex: 0,
      timerEndedAt: null,
      // Starting collection means the test is underway.
      ...(test.status === "DRAFT" ? { status: "IN_PROGRESS" as const } : {}),
    },
  });

  await recordAudit({
    action: "STATUS_CHANGE",
    entity: "BreathTest",
    entityId: testId,
    breathTestId: testId,
    actorId: actor.id,
    actorRole: actor.role,
    summary: `Started sample collection timer (every ${data.intervalMinutes} min, ${data.totalSamples} samples)`,
    metadata: {
      intervalMinutes: data.intervalMinutes,
      totalSamples: data.totalSamples,
      previousStatus: test.status,
    },
    ...ctx,
  });
}

/**
 * Acknowledge that sample `sampleIndex` has been collected, arming the next
 * interval. The update is conditional on the current acked index so two nurses
 * clicking at once cannot double-advance the schedule.
 */
export async function acknowledgeSample(
  actor: CurrentUser,
  testId: string,
  sampleIndex: number,
  ctx: Ctx
): Promise<void> {
  authorize(actor.role, "test:timer");

  const test = await prisma.breathTest.findUnique({
    where: { id: testId },
    select: {
      status: true,
      timerStartedAt: true,
      timerTotalSamples: true,
      timerAckedIndex: true,
      timerEndedAt: true,
    },
  });
  if (!test) throw new Error("Test not found.");
  if (test.status === "FINALIZED") throw new ReportLockedError();
  if (!test.timerStartedAt || test.timerEndedAt) {
    throw new Error("No collection timer is running for this test.");
  }

  const total = test.timerTotalSamples ?? 0;
  if (sampleIndex < 1 || sampleIndex >= total) {
    throw new Error("That sample is not part of the collection schedule.");
  }

  const isLast = sampleIndex === total - 1;
  const result = await prisma.breathTest.updateMany({
    // Only advance from the exact expected index — a stale click is a no-op.
    where: { id: testId, timerAckedIndex: sampleIndex - 1, timerEndedAt: null },
    data: {
      timerAckedIndex: sampleIndex,
      ...(isLast ? { timerEndedAt: new Date() } : {}),
    },
  });
  if (result.count === 0) {
    // Someone else already acknowledged it; treat as success so the UI settles.
    return;
  }

  await recordAudit({
    action: "UPDATE",
    entity: "BreathTest",
    entityId: testId,
    breathTestId: testId,
    actorId: actor.id,
    actorRole: actor.role,
    summary: `Acknowledged sample ${sampleIndex} of ${total - 1}`,
    metadata: { sampleIndex, totalSamples: total, completed: isLast },
    ...ctx,
  });
}

/** Stop a running timer, e.g. because the report was finalized. */
export async function stopTimer(
  tx: Prisma.TransactionClient | typeof prisma,
  testId: string
): Promise<void> {
  await tx.breathTest.updateMany({
    where: { id: testId, timerStartedAt: { not: null }, timerEndedAt: null },
    data: { timerEndedAt: new Date() },
  });
}
