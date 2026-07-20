"use client";

import { useActionState, useState, useTransition } from "react";
import {
  acknowledgeSampleAction,
  startTimerAction,
  type TimerFormState,
} from "@/app/tests/[id]/timer-actions";
import { formatCountdown, useTimers } from "@/components/TimerProvider";
import { formatClock12 } from "@/lib/time-format";

const DEFAULT_INTERVAL = 30;
const DEFAULT_TOTAL_SAMPLES = 7; // baseline + 6 × 30 min = 3 hours

export interface TimerState {
  startedAt: string | null; // ISO
  intervalMinutes: number;
  totalSamples: number | null;
  ackedIndex: number;
  endedAt: string | null; // ISO
}

/** Format an ISO instant as a friendly wall-clock time ("1:30 PM"). */
function clockOf(iso: string): string {
  return formatClock12(new Date(iso).toTimeString().slice(0, 5));
}

// Per-test view of the collection schedule. Before start it configures the
// cadence; after start it shows every sample's due time and which one is next.
export function TimerPanel({
  testId,
  timer,
  canManage,
}: {
  testId: string;
  timer: TimerState;
  canManage: boolean;
}) {
  const { timers, remainingMs, refresh } = useTimers();
  const [state, formAction, starting] = useActionState<TimerFormState, FormData>(
    startTimerAction,
    {}
  );
  const [ackPending, startAck] = useTransition();
  const [ackError, setAckError] = useState<string | null>(null);

  // The live entry (if any) comes from the shared poll so this panel counts down
  // in step with the header.
  const live = timers.find((t) => t.testId === testId);

  if (!timer.startedAt || timer.endedAt) {
    const finished = Boolean(timer.startedAt && timer.endedAt);
    if (!canManage) {
      return (
        <p className="text-sm text-slate-400">
          {finished ? "Sample collection is complete." : "No collection timer running."}
        </p>
      );
    }
    return (
      <form action={formAction} className="flex flex-wrap items-end gap-4">
        <input type="hidden" name="testId" value={testId} />
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
            Interval (min)
          </label>
          <input
            type="number"
            name="intervalMinutes"
            min={1}
            max={240}
            defaultValue={timer.intervalMinutes || DEFAULT_INTERVAL}
            className="input mt-1 w-28 px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">
            Total samples
          </label>
          <input
            type="number"
            name="totalSamples"
            min={2}
            max={50}
            defaultValue={timer.totalSamples ?? DEFAULT_TOTAL_SAMPLES}
            className="input mt-1 w-28 px-2 py-1"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={starting}>
          {starting ? "Starting…" : finished ? "Restart collection" : "Start collection"}
        </button>
        {state.error && (
          <p className="w-full text-sm text-red-700">{state.error}</p>
        )}
        <p className="w-full text-xs text-slate-500">
          Sample 0 is the baseline taken at start; the countdown then runs to each
          following sample.
        </p>
      </form>
    );
  }

  const startedAt = new Date(timer.startedAt);
  const total = timer.totalSamples ?? 0;
  const nextIndex = timer.ackedIndex + 1;

  function acknowledge(index: number) {
    setAckError(null);
    startAck(async () => {
      const res = await acknowledgeSampleAction(testId, index);
      if (res.error) setAckError(res.error);
      refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={`rounded-lg px-4 py-2 ${
            live && remainingMs(live) <= 0
              ? "bg-red-50 text-red-700"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide opacity-70">
            {live ? `Next: sample ${live.nextSampleIndex}` : "Collection complete"}
          </p>
          <p className="font-mono text-2xl tabular-nums">
            {live
              ? remainingMs(live) <= 0
                ? "DUE NOW"
                : formatCountdown(remainingMs(live))
              : "—"}
          </p>
        </div>
        <p className="text-sm text-slate-500">
          Started {clockOf(timer.startedAt)} — every {timer.intervalMinutes} min,{" "}
          {total} samples.
        </p>
        <div className="flex-1" />
        {canManage && live && (
          <button
            type="button"
            className="btn-primary"
            disabled={ackPending}
            onClick={() => acknowledge(nextIndex)}
          >
            {ackPending ? "Saving…" : `Acknowledge sample ${nextIndex}`}
          </button>
        )}
      </div>

      {ackError && <p className="text-sm text-red-700">{ackError}</p>}

      <div className="overflow-hidden rounded-lg border border-clinical-border">
        <table className="min-w-full divide-y divide-clinical-border text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Sample</th>
              <th className="px-4 py-2">Interval</th>
              <th className="px-4 py-2">Due at</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clinical-border">
            {Array.from({ length: total }, (_, index) => {
              const due = new Date(
                startedAt.getTime() + index * timer.intervalMinutes * 60_000
              );
              const done = index <= timer.ackedIndex;
              const isNext = index === nextIndex;
              return (
                <tr key={index} className={isNext ? "bg-brand/5" : undefined}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    #{index}
                    {index === 0 && (
                      <span className="ml-2 text-xs text-slate-400">baseline</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {index * timer.intervalMinutes} min
                  </td>
                  <td className="px-4 py-2 text-slate-600">{clockOf(due.toISOString())}</td>
                  <td className="px-4 py-2">
                    {done ? (
                      <span className="text-emerald-700">✓ Collected</span>
                    ) : isNext && live && remainingMs(live) <= 0 ? (
                      <span className="font-medium text-red-700">Due now</span>
                    ) : isNext ? (
                      <span className="text-amber-700">Next</span>
                    ) : (
                      <span className="text-slate-400">Upcoming</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
