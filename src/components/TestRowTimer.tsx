"use client";

import { formatCountdown, useTimers } from "@/components/TimerProvider";

// Inline countdown shown next to a test's status pill in the tests list.
// Reads the same shared poll as the header, so nothing extra is fetched.
export function TestRowTimer({ testId }: { testId: string }) {
  const { timers, remainingMs } = useTimers();
  const timer = timers.find((t) => t.testId === testId);
  if (!timer) return null;

  const left = remainingMs(timer);
  const due = left <= 0;
  return (
    <span
      className={`ml-2 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-xs tabular-nums ${
        due ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
      }`}
      title={`Sample ${timer.nextSampleIndex} of ${timer.totalSamples - 1}`}
    >
      ⏱ {due ? "DUE" : formatCountdown(left)}
    </span>
  );
}
