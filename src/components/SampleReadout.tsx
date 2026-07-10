import { sampleTotal } from "@/lib/sample-math";

export interface ReadonlySample {
  sampleNumber: number;
  timeMinutes: number;
  h2Ppm: number | null;
  ch4Ppm: number | null;
  co2Percent: number | null;
  correctionFactor: number | null;
  symptoms: string | null;
  skipped: boolean;
  skippedReason: string | null;
}

function fmt(v: number | null, digits = 1): string {
  return v == null ? "—" : v.toFixed(digits);
}

/** Read-only rendering of a test's samples, with derived H2+CH4. */
export function SampleReadout({ samples }: { samples: ReadonlySample[] }) {
  if (samples.length === 0) {
    return <p className="mt-3 text-sm text-slate-400">No samples entered yet.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-clinical-border">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Time (min)</th>
            <th className="px-3 py-2 text-right">H₂ (ppm)</th>
            <th className="px-3 py-2 text-right">CH₄ (ppm)</th>
            <th className="px-3 py-2 text-right">H₂+CH₄</th>
            <th className="px-3 py-2 text-right">CO₂ (%)</th>
            <th className="px-3 py-2 text-right">Corr.</th>
            <th className="px-3 py-2">Symptoms</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-clinical-border">
          {samples.map((s) => {
            const total = sampleTotal(s.h2Ppm, s.ch4Ppm);
            return (
              <tr key={s.sampleNumber} className={s.skipped ? "bg-slate-50 text-slate-400" : ""}>
                <td className="px-3 py-2">{s.sampleNumber}</td>
                <td className="px-3 py-2">{s.timeMinutes}</td>
                {s.skipped ? (
                  <td colSpan={6} className="px-3 py-2 italic">
                    Skipped — {s.skippedReason || "no reason given"}
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-2 text-right">{fmt(s.h2Ppm)}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.ch4Ppm)}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700">{fmt(total)}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.co2Percent)}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.correctionFactor, 3)}</td>
                    <td className="px-3 py-2">{s.symptoms || "—"}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
