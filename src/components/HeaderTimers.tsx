"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { acknowledgeSampleAction } from "@/app/tests/[id]/timer-actions";
import { formatCountdown, useTimers } from "@/components/TimerProvider";
import { formatClock12 } from "@/lib/time-format";

// Header countdown pill. Shows the most urgent timer inline and the rest in a
// dropdown, so a nurse running several patients can see every schedule at once.
// Renders nothing when no test has a running timer.
export function HeaderTimers({ canManageTimers }: { canManageTimers: boolean }) {
  const { timers, remainingMs, refresh } = useTimers();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (timers.length === 0) return null;

  // The provider sorts by due time, so the first entry is the most urgent.
  const soonest = timers[0];
  const anyDue = timers.some((t) => remainingMs(t) <= 0);

  function acknowledge(testId: string, sampleIndex: number) {
    startTransition(async () => {
      await acknowledgeSampleAction(testId, sampleIndex);
      refresh();
    });
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          anyDue
            ? "animate-fade-in-up bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }`}
        title="Sample collection timers"
      >
        <span aria-hidden>⏱</span>
        <span className="font-mono tabular-nums">
          {remainingMs(soonest) <= 0 ? "DUE NOW" : formatCountdown(remainingMs(soonest))}
        </span>
        <span className="hidden max-w-[10rem] truncate sm:inline">
          {soonest.patientName} #{soonest.nextSampleIndex}
        </span>
        {timers.length > 1 && (
          <span className="rounded-full bg-white/70 px-1.5 text-xs">+{timers.length - 1}</span>
        )}
      </button>

      {open && (
        <div className="animate-fade-in-up absolute right-0 z-30 mt-2 w-96 overflow-hidden rounded-lg border border-clinical-border bg-white shadow-lg">
          <p className="border-b border-clinical-border bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Sample collection timers
          </p>
          <ul className="max-h-96 divide-y divide-clinical-border overflow-y-auto">
            {timers.map((t) => {
              const left = remainingMs(t);
              const due = left <= 0;
              return (
                <li key={t.testId} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {t.patientName}{" "}
                        <span className="font-mono text-xs text-slate-500">
                          (MRN {t.patientMrn})
                        </span>
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {t.testTypeName} — sample {t.nextSampleIndex} of {t.totalSamples - 1}, due{" "}
                        {formatClock12(
                          new Date(t.nextDueAt).toTimeString().slice(0, 5)
                        )}
                      </p>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded px-2 py-0.5 font-mono text-sm tabular-nums ${
                        due ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {due ? "DUE NOW" : formatCountdown(left)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <Link
                      href={`/tests/${t.testId}/samples`}
                      onClick={() => setOpen(false)}
                      className="text-brand hover:underline"
                    >
                      Enter sample
                    </Link>
                    {canManageTimers && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => acknowledge(t.testId, t.nextSampleIndex)}
                        className="text-slate-500 hover:text-slate-900 disabled:opacity-50"
                      >
                        Acknowledge #{t.nextSampleIndex}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
