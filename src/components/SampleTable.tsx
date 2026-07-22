"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  saveSamplesAction,
  completeSampleCollectionAction,
  type SamplesFormState,
} from "@/app/tests/[id]/samples/actions";
import { sampleTotal } from "@/lib/sample-math";
import { formatClock12, parseClockInput } from "@/lib/time-format";
import { BreathChart } from "@/components/BreathChart";
import { CH4_TRIGGER_PPM } from "@/lib/chart-geometry";

// Number of blank rows shown by default when entering a fresh test.
const DEFAULT_ROWS = 6;

export interface EditableRow {
  sampleNumber: number;
  timeMinutes: number | "";
  clockTime: string; // standardized 24h "HH:mm", or "" when unset
  h2Ppm: number | "";
  ch4Ppm: number | "";
  co2Percent: number | "";
  correctionFactor: number | "";
  symptoms: string;
  skipped: boolean;
  skippedReason: string;
}

// Interval defaults to a 30-minute cadence (0, 30, 60, ...) based on sample
// number; the technician can still override it per row.
function emptyRow(sampleNumber: number): EditableRow {
  return {
    sampleNumber,
    timeMinutes: sampleNumber * 30,
    clockTime: "",
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

// A row the user never touched — skip it on save so blank default rows don't
// persist as empty samples.
function isBlankRow(r: EditableRow): boolean {
  return (
    r.clockTime === "" &&
    r.h2Ppm === "" &&
    r.ch4Ppm === "" &&
    r.co2Percent === "" &&
    r.correctionFactor === "" &&
    r.symptoms.trim() === "" &&
    !r.skipped
  );
}

// Start with the saved rows, padded up to DEFAULT_ROWS blank rows for entry.
function buildInitialRows(saved: EditableRow[]): EditableRow[] {
  const rows = [...saved];
  let next = rows.length === 0 ? 0 : rows[rows.length - 1].sampleNumber + 1;
  while (rows.length < DEFAULT_ROWS) {
    rows.push(emptyRow(next++));
  }
  return rows;
}

export function SampleTable({
  testId,
  initialRows,
  h2RiseThreshold,
}: {
  testId: string;
  initialRows: EditableRow[];
  h2RiseThreshold?: number | null;
}) {
  const [rows, setRows] = useState<EditableRow[]>(() => buildInitialRows(initialRows));
  const [showChart, setShowChart] = useState(false);
  const [state, formAction, pending] = useActionState<SamplesFormState, FormData>(
    saveSamplesAction,
    {}
  );
  const [completeState, completeFormAction, completing] = useActionState<SamplesFormState, FormData>(
    completeSampleCollectionAction,
    {}
  );

  function update<K extends keyof EditableRow>(i: number, key: K, value: EditableRow[K]) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setRows((prev) => {
      const nextNum = prev.length === 0 ? 0 : prev[prev.length - 1].sampleNumber + 1;
      return [...prev, emptyRow(nextNum)];
    });
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  const chartSamples = rows.map((r) => ({
    sampleNumber: r.sampleNumber,
    timeMinutes: r.timeMinutes === "" ? 0 : Number(r.timeMinutes),
    h2Ppm: numOrNull(r.h2Ppm),
    ch4Ppm: numOrNull(r.ch4Ppm),
    skipped: r.skipped,
  }));

  const serialized = JSON.stringify(
    rows.filter((r) => !isBlankRow(r)).map((r) => ({
      sampleNumber: r.sampleNumber,
      timeMinutes: r.timeMinutes === "" ? 0 : r.timeMinutes,
      clockTime: r.clockTime,
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
    <div className="space-y-4">
      {(state.error || completeState.error) && (
        <div className="animate-fade-in-up rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error || completeState.error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-clinical-border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Interval (min)</th>
              <th className="px-2 py-2">Time</th>
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
                    <ClockCell value={r.clockTime} onChange={(v) => update(i, "clockTime", v)} />
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
        <button
          type="button"
          onClick={() => setShowChart((v) => !v)}
          className="btn-secondary"
        >
          {showChart ? "Hide graph" : "Generate graph"}
        </button>
        <div className="flex-1" />
        <Link href={`/tests/${testId}`} className="btn-secondary">
          Cancel
        </Link>
        <form
          action={completeFormAction}
          onSubmit={(e) => {
            if (
              !confirm(
                "Mark sample collection complete? This saves the current samples and locks the report for physician review."
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="testId" value={testId} />
          <input type="hidden" name="rows" value={serialized} />
          <button type="submit" className="btn-secondary" disabled={pending || completing}>
            {completing ? "Completing…" : "Mark sample collection complete"}
          </button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="testId" value={testId} />
          <input type="hidden" name="rows" value={serialized} />
          <button type="submit" className="btn-primary" disabled={pending || completing}>
            {pending ? "Saving…" : "Save samples"}
          </button>
        </form>
      </div>

      {/* On-demand charts built from the current (unsaved) rows, so the entry
          person can review the curves before saving. */}
      {showChart && (
        <div className="animate-fade-in-up grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-clinical-border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              H₂ over time
            </h3>
            <BreathChart samples={chartSamples} series={["h2"]} h2RiseThreshold={h2RiseThreshold} />
          </div>
          <div className="rounded-lg border border-clinical-border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              CH₄ over time
            </h3>
            <BreathChart samples={chartSamples} series={["ch4"]} ch4Threshold={CH4_TRIGGER_PPM} />
          </div>
        </div>
      )}
    </div>
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

// Free-text clock entry that normalizes on blur: "1330" → "1:30 PM" on screen,
// stored as standard 24h "HH:mm". `value` is always the standardized form.
function ClockCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [text, setText] = useState(() => formatClock12(value));

  // Resync when the row's stored value changes (e.g. rows removed/reordered).
  useEffect(() => {
    setText(formatClock12(value));
  }, [value]);

  function commit() {
    const std = parseClockInput(text);
    onChange(std ?? "");
    setText(std ? formatClock12(std) : "");
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="e.g. 1:30 PM"
      className="input w-24 px-2 py-1"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
}
