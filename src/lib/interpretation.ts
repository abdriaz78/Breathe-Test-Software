// -----------------------------------------------------------------------------
// Interpretation SUPPORT engine.
//
// IMPORTANT CLINICAL RULE: this module NEVER diagnoses a patient. It evaluates
// approved, configurable thresholds against the sample series and returns
// non-binding "support flags" for the physician to consider. The final
// diagnosis and recommendation are authored by the physician alone.
// -----------------------------------------------------------------------------

export interface SampleForInterpretation {
  timeMinutes: number;
  h2Ppm: number | null;
  ch4Ppm: number | null;
  skipped: boolean;
}

// Shape of TestType.interpretationRules (all optional; absent => not evaluated).
export interface InterpretationRules {
  /** H2 rise above baseline (ppm) suggestive per approved criteria. */
  h2RiseFromBaselinePpm?: number;
  /** Absolute CH4 (ppm) at any point suggestive per approved criteria. */
  ch4AbsolutePpm?: number;
  /** Combined H2+CH4 rise above baseline (ppm). */
  combinedRiseFromBaselinePpm?: number;
}

export type FlagLevel = "info" | "attention";

export interface InterpretationFlag {
  code: string;
  level: FlagLevel;
  message: string;
  detail?: string;
}

export interface InterpretationResult {
  flags: InterpretationFlag[];
  /** Always present, always shown near any flag. */
  disclaimer: string;
}

const DISCLAIMER =
  "These are automated interpretation-support flags based on configured thresholds. " +
  "They are NOT a diagnosis. Clinical interpretation, diagnosis, and recommendations " +
  "are the responsibility of the reviewing physician.";

function baseline(values: number[]): number | null {
  return values.length ? values[0] : null;
}

export function computeInterpretation(
  samples: SampleForInterpretation[],
  rules: InterpretationRules | null | undefined
): InterpretationResult {
  const flags: InterpretationFlag[] = [];
  if (!rules) return { flags, disclaimer: DISCLAIMER };

  const active = samples
    .filter((s) => !s.skipped)
    .sort((a, b) => a.timeMinutes - b.timeMinutes);

  const h2 = active.map((s) => s.h2Ppm).filter((v): v is number => v != null);
  const ch4 = active.map((s) => s.ch4Ppm).filter((v): v is number => v != null);
  const combined = active
    .map((s) => (s.h2Ppm ?? 0) + (s.ch4Ppm ?? 0))
    .filter((_, i) => active[i].h2Ppm != null || active[i].ch4Ppm != null);

  // H2 rise from baseline
  if (rules.h2RiseFromBaselinePpm != null && h2.length) {
    const base = baseline(h2) ?? 0;
    const peak = Math.max(...h2);
    const rise = peak - base;
    if (rise >= rules.h2RiseFromBaselinePpm) {
      flags.push({
        code: "H2_RISE",
        level: "attention",
        message: `H₂ rise of ${rise.toFixed(1)} ppm meets the configured threshold (≥ ${rules.h2RiseFromBaselinePpm} ppm).`,
        detail: `Baseline ${base.toFixed(1)} ppm → peak ${peak.toFixed(1)} ppm.`,
      });
    }
  }

  // Absolute CH4
  if (rules.ch4AbsolutePpm != null && ch4.length) {
    const peak = Math.max(...ch4);
    if (peak >= rules.ch4AbsolutePpm) {
      flags.push({
        code: "CH4_ABSOLUTE",
        level: "attention",
        message: `Peak CH₄ of ${peak.toFixed(1)} ppm meets the configured threshold (≥ ${rules.ch4AbsolutePpm} ppm).`,
      });
    }
  }

  // Combined H2+CH4 rise
  if (rules.combinedRiseFromBaselinePpm != null && combined.length) {
    const base = baseline(combined) ?? 0;
    const peak = Math.max(...combined);
    const rise = peak - base;
    if (rise >= rules.combinedRiseFromBaselinePpm) {
      flags.push({
        code: "COMBINED_RISE",
        level: "attention",
        message: `Combined H₂+CH₄ rise of ${rise.toFixed(1)} ppm meets the configured threshold (≥ ${rules.combinedRiseFromBaselinePpm} ppm).`,
      });
    }
  }

  if (!flags.length) {
    flags.push({
      code: "NO_FLAGS",
      level: "info",
      message: "No configured thresholds were met.",
    });
  }

  return { flags, disclaimer: DISCLAIMER };
}

// -----------------------------------------------------------------------------
// Compact 2-line result summary. The verdict depends on H2 alone:
//
//   H2 rise >= threshold at ANY point in the collection -> Positive
//   Otherwise                                            -> Negative
//
// Matches what's plotted on the chart: the trigger line runs across the full
// collection with no time cutoff, so a point above it must read Positive.
//
// CH4 and combined H2+CH4 readings do not affect this verdict (they still
// appear as separate, non-binding support flags via computeInterpretation).
// The verdict IS a Positive/Negative label (this mirrors a standard lab
// report), but it is still computed from a configurable, physician-approved
// threshold, not a clinical judgment — the disclaimer beside every flag makes
// that boundary explicit.
// -----------------------------------------------------------------------------

export interface ResultSummary {
  verdict: "Positive" | "Negative";
  /** e.g. "H₂-baseline 7 PPM, Trigger line 27 PPM, Max. 46 PPM, measurement for 1 hr, 33 min." */
  statsLine: string;
  /** True when the verdict is Positive — for UI emphasis only. */
  anyMet: boolean;
}

function fmtDuration(totalMinutes: number): string {
  const whole = Math.round(totalMinutes);
  if (whole <= 0) return "0 min";
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  const hrPart = h > 0 ? `${h} hr${h === 1 ? "" : "s"}` : "";
  const minPart = m > 0 ? `${m} min` : "";
  return [hrPart, minPart].filter(Boolean).join(", ");
}

// -----------------------------------------------------------------------------
// CH4 / IMO (Intestinal Methanogen Overgrowth) verdict.
//
// Unlike the H2 verdict, this is a single fixed absolute threshold (no
// baseline offset) — it mirrors the CH4 trigger line drawn on the chart
// (see CH4_TRIGGER_PPM in lib/chart-geometry.ts): a peak CH4 reading at or
// above the threshold at ANY point in the collection is IMO Positive.
// -----------------------------------------------------------------------------

export interface Ch4ResultSummary {
  verdict: "IMO Positive" | "IMO Negative";
  /** e.g. "CH₄ peak 14 PPM (threshold 12 PPM)." */
  statsLine: string;
  /** True when the verdict is Positive — for UI emphasis only. */
  anyMet: boolean;
}

export function summarizeCh4Result(
  samples: SampleForInterpretation[],
  thresholdPpm: number
): Ch4ResultSummary | null {
  const active = samples.filter((s) => !s.skipped);
  const ch4 = active.map((s) => s.ch4Ppm).filter((v): v is number => v != null);
  if (!ch4.length) return null;

  const peak = Math.max(...ch4);
  const positive = peak >= thresholdPpm;

  return {
    verdict: positive ? "IMO Positive" : "IMO Negative",
    statsLine: `CH₄ peak ${peak.toFixed(0)} PPM (threshold ${thresholdPpm} PPM).`,
    anyMet: positive,
  };
}

export function summarizeResult(
  samples: SampleForInterpretation[],
  rules: InterpretationRules | null | undefined
): ResultSummary | null {
  if (!rules || rules.h2RiseFromBaselinePpm == null) return null;

  const active = samples
    .filter((s) => !s.skipped)
    .sort((a, b) => a.timeMinutes - b.timeMinutes);
  if (active.length === 0) return null;

  const h2 = active.map((s) => s.h2Ppm).filter((v): v is number => v != null);
  if (!h2.length) return null;

  const times = active.map((s) => s.timeMinutes);
  const duration = fmtDuration(Math.max(...times) - Math.min(...times));

  // H2 rise from baseline, across the full collection, is the sole driver of
  // the verdict — CH4 does not affect it.
  const base = baseline(h2) ?? 0;
  const peak = Math.max(...h2);
  const trigger = base + rules.h2RiseFromBaselinePpm;
  const positive = peak - base >= rules.h2RiseFromBaselinePpm;

  return {
    verdict: positive ? "Positive" : "Negative",
    statsLine: `H₂-baseline ${base.toFixed(0)} PPM, Trigger line ${trigger.toFixed(0)} PPM, Max. ${peak.toFixed(0)} PPM, measurement for ${duration}.`,
    anyMet: positive,
  };
}
