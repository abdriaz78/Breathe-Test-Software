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
