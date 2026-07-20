"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { acknowledgeSampleAction } from "@/app/tests/[id]/timer-actions";
import { useTimers } from "@/components/TimerProvider";

// Banner shown under the header while one or more samples are due. Dismissal is
// keyed by test + sample index, so clearing it does not hide the *next* sample
// when it comes due a moment later.
export function DueBanner({ canManageTimers }: { canManageTimers: boolean }) {
  const { timers, remainingMs, refresh } = useTimers();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const due = timers.filter(
    (t) => remainingMs(t) <= 0 && !dismissed.includes(`${t.testId}:${t.nextSampleIndex}`)
  );
  if (due.length === 0) return null;

  function acknowledge(testId: string, sampleIndex: number) {
    startTransition(async () => {
      await acknowledgeSampleAction(testId, sampleIndex);
      refresh();
    });
  }

  return (
    <div className="sticky top-[73px] z-10 border-b border-red-200 bg-red-50">
      <div className="mx-auto max-w-6xl space-y-2 px-6 py-3">
        {due.map((t) => (
          <div
            key={`${t.testId}:${t.nextSampleIndex}`}
            className="animate-fade-in-up flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-red-800"
          >
            <span aria-hidden>⏱</span>
            <span className="font-medium">
              Sample {t.nextSampleIndex} due now for {t.patientName}{" "}
              <span className="font-mono text-xs">(MRN {t.patientMrn})</span>
            </span>
            <div className="flex-1" />
            <Link
              href={`/tests/${t.testId}/samples`}
              className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
            >
              Enter sample
            </Link>
            {canManageTimers && (
              <button
                type="button"
                disabled={pending}
                onClick={() => acknowledge(t.testId, t.nextSampleIndex)}
                className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
              >
                Acknowledge
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setDismissed((prev) => [...prev, `${t.testId}:${t.nextSampleIndex}`])
              }
              className="text-red-400 transition-colors hover:text-red-700"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
