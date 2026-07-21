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
// Compact 2-line result summary, following the standard SIBO/breath-test
// interpretation pathway (an ordered, short-circuit chain, not independent
// thresholds):
//
//   1. CH4 >= threshold at ANY time         -> Positive (IMO pathway)
//   2. H2 rise >= threshold in first 120min -> Positive (Hydrogen SIBO pathway)
//   3. Combined rise >= threshold in first 120min -> Positive (SIBO pathway)
//   4. Otherwise                            -> Negative
//
// Only steps whose threshold is configured on the test type are evaluated; a
// test type with just an H2 rule (e.g. lactose malabsorption) skips the CH4
// and combined steps entirely. The verdict IS a Positive/Negative label (this
// mirrors a standard lab report), but it is still computed from configurable,
// physician-approved thresholds, not a clinical judgment — the disclaimer
// beside every flag makes that boundary explicit.
// -----------------------------------------------------------------------------

/** SIBO interpretation pathway restricts the H2 and combined rise checks to
 * this window from baseline; CH4 has no time restriction ("at any time"). */
const RISE_WINDOW_MINUTES = 120;

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

export function summarizeResult(
  samples: SampleForInterpretation[],
  rules: InterpretationRules | null | undefined
): ResultSummary | null {
  if (!rules) return null;

  const active = samples
    .filter((s) => !s.skipped)
    .sort((a, b) => a.timeMinutes - b.timeMinutes);
  if (active.length === 0) return null;

  const inWindow = active.filter((s) => s.timeMinutes <= RISE_WINDOW_MINUTES);

  const times = active.map((s) => s.timeMinutes);
  const duration = fmtDuration(Math.max(...times) - Math.min(...times));

  const statsParts: string[] = [];
  let positive = false;
  let evaluatedAny = false;

  // Step 1 — CH4, any time, no short-circuit skip for the other steps if this
  // threshold isn't configured.
  if (!positive && rules.ch4AbsolutePpm != null) {
    const ch4 = active.map((s) => s.ch4Ppm).filter((v): v is number => v != null);
    if (ch4.length) {
      evaluatedAny = true;
      const peak = Math.max(...ch4);
      statsParts.push(
        `CH₄ trigger line ${rules.ch4AbsolutePpm.toFixed(0)} PPM, Max. ${peak.toFixed(0)} PPM`
      );
      if (peak >= rules.ch4AbsolutePpm) positive = true;
    }
  }

  // Step 2 — H2 rise from baseline, restricted to the first 120 minutes.
  if (!positive && rules.h2RiseFromBaselinePpm != null) {
    const h2 = inWindow.map((s) => s.h2Ppm).filter((v): v is number => v != null);
    if (h2.length) {
      evaluatedAny = true;
      const base = baseline(h2) ?? 0;
      const peak = Math.max(...h2);
      const trigger = base + rules.h2RiseFromBaselinePpm;
      statsParts.push(
        `H₂-baseline ${base.toFixed(0)} PPM, Trigger line ${trigger.toFixed(0)} PPM, Max. ${peak.toFixed(0)} PPM`
      );
      if (peak - base >= rules.h2RiseFromBaselinePpm) positive = true;
    }
  }

  // Step 3 — combined H2+CH4 rise from baseline, also within 120 minutes.
  if (!positive && rules.combinedRiseFromBaselinePpm != null) {
    const combinedSamples = inWindow.filter((s) => s.h2Ppm != null || s.ch4Ppm != null);
    const combined = combinedSamples.map((s) => (s.h2Ppm ?? 0) + (s.ch4Ppm ?? 0));
    if (combined.length) {
      evaluatedAny = true;
      const base = baseline(combined) ?? 0;
      const peak = Math.max(...combined);
      const trigger = base + rules.combinedRiseFromBaselinePpm;
      statsParts.push(
        `H₂+CH₄-baseline ${base.toFixed(0)} PPM, Trigger line ${trigger.toFixed(0)} PPM, Max. ${peak.toFixed(0)} PPM`
      );
      if (peak - base >= rules.combinedRiseFromBaselinePpm) positive = true;
    }
  }

  if (!evaluatedAny) return null;

  return {
    verdict: positive ? "Positive" : "Negative",
    statsLine: `${statsParts.join(", ")}, measurement for ${duration}.`,
    anyMet: positive,
  };
}
