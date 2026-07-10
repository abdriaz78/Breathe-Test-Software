"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveSamplesAction, type SamplesFormState } from "@/app/tests/[id]/samples/actions";
import { sampleTotal } from "@/lib/sample-math";

export interface EditableRow {
  sampleNumber: number;
  timeMinutes: number | "";
  h2Ppm: number | "";
  ch4Ppm: number | "";
  co2Percent: number | "";
  correctionFactor: number | "";
  symptoms: string;
  skipped: boolean;
  skippedReason: string;
}

function emptyRow(sampleNumber: number, timeMinutes: number | ""): EditableRow {
  return {
    sampleNumber,
    timeMinutes,
    h2Ppm: "",
    ch4Ppm: "",
    co2Percent: "",
    correctionFactor: "",
    symptoms: "",
    skipped: false,
    skippedReason: "",
  };
}

const numOrNull = (v: number | "") => (v === "" ? null : Number(v));

export function SampleTable({
  testId,
  initialRows,
}: {
  testId: string;
  initialRows: EditableRow[];
}) {
  const [rows, setRows] = useState<EditableRow[]>(
    initialRows.length ? initialRows : [emptyRow(1, 0)]
  );
  const [state, formAction, pending] = useActionState<SamplesFormState, FormData>(
    saveSamplesAction,
    {}
  );

  function update<K extends keyof EditableRow>(i: number, key: K, value: EditableRow[K]) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      const nextNum = (last?.sampleNumber ?? 0) + 1;
      const lastTime = typeof last?.timeMinutes === "number" ? last.timeMinutes : 0;
      // Suggest a +20 min interval, a common breath-test cadence.
      return [...prev, emptyRow(nextNum, lastTime + 20)];
    });
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  const serialized = JSON.stringify(
    rows.map((r) => ({
      sampleNumber: r.sampleNumber,
      timeMinutes: r.timeMinutes === "" ? 0 : r.timeMinutes,
      h2Ppm: numOrNull(r.h2Ppm),
      ch4Ppm: numOrNull(r.ch4Ppm),
      co2Percent: numOrNull(r.co2Percent),
      correctionFactor: numOrNull(r.correctionFactor),
      symptoms: r.symptoms,
      skipped: r.skipped,
      skippedReason: r.skippedReason,
    }))
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="testId" value={testId} />
      <input type="hidden" name="rows" value={serialized} />

      {state.error && (
        <div className="animate-fade-in-up rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      )}

      <div className="overflow-x-auto rounded-lg border border-clinical-border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Time (min)</th>
              <th className="px-2 py-2">H₂ (ppm)</th>
              <th className="px-2 py-2">CH₄ (ppm)</th>
              <th className="px-2 py-2">H₂+CH₄</th>
              <th className="px-2 py-2">CO₂ (%)</th>
              <th className="px-2 py-2">Corr. factor</th>
              <th className="px-2 py-2">Symptoms</th>
              <th className="px-2 py-2 text-center">Skip</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-clinical-border">
            {rows.map((r, i) => {
              const total = sampleTotal(numOrNull(r.h2Ppm), numOrNull(r.ch4Ppm));
              const disabled = r.skipped;
              return (
                <tr key={i} className={`transition-colors duration-150 ${disabled ? "bg-slate-50/60" : "hover:bg-brand/5"}`}>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      className="input w-16 px-2 py-1"
                      value={r.sampleNumber}
                      onChange={(e) => update(i, "sampleNumber", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <NumCell value={r.timeMinutes} onChange={(v) => update(i, "timeMinutes", v)} width="w-20" />
                  </td>
                  <td className="px-2 py-1">
                    <NumCell value={r.h2Ppm} onChange={(v) => update(i, "h2Ppm", v)} disabled={disabled} />
                  </td>
                  <td className="px-2 py-1">
                    <NumCell value={r.ch4Ppm} onChange={(v) => update(i, "ch4Ppm", v)} disabled={disabled} />
                  </td>
                  <td className="px-2 py-1 text-right font-medium text-slate-700">
                    {disabled ? "—" : total != null ? total.toFixed(1) : "—"}
                  </td>
                  <td className="px-2 py-1">
                    <NumCell value={r.co2Percent} onChange={(v) => update(i, "co2Percent", v)} disabled={disabled} />
                  </td>
                  <td className="px-2 py-1">
                    <NumCell value={r.correctionFactor} onChange={(v) => update(i, "correctionFactor", v)} disabled={disabled} step="0.001" />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      className="input w-40 px-2 py-1"
                      value={r.symptoms}
                      onChange={(e) => update(i, "symptoms", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={r.skipped}
                      onChange={(e) => update(i, "skipped", e.target.checked)}
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-slate-400 hover:text-red-600"
                      title="Remove row"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Skipped-reason inputs shown below the grid for any skipped rows. */}
      {rows.some((r) => r.skipped) && (
        <div className="animate-fade-in-up space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
            Skipped sample reasons
          </p>
          {rows.map((r, i) =>
            r.skipped ? (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 text-sm text-amber-900">#{r.sampleNumber}</span>
                <input
                  type="text"
                  className="input flex-1 px-2 py-1"
                  placeholder="Reason this sample was skipped (required)"
                  value={r.skippedReason}
                  onChange={(e) => update(i, "skippedReason", e.target.value)}
                />
              </div>
            ) : null
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={addRow} className="btn-secondary">
          + Add sample
        </button>
        <div className="flex-1" />
        <Link href={`/tests/${testId}`} className="btn-secondary">
          Cancel
        </Link>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save samples"}
        </button>
      </div>
    </form>
  );
}

function NumCell({
  value,
  onChange,
  disabled,
  step,
  width = "w-24",
}: {
  value: number | "";
  onChange: (v: number | "") => void;
  disabled?: boolean;
  step?: string;
  width?: string;
}) {
  return (
    <input
      type="number"
      step={step}
      disabled={disabled}
      className={`input ${width} px-2 py-1 disabled:bg-slate-100`}
      value={value}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
    />
  );
}
