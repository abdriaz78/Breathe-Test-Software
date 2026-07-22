import { sampleTotal } from "./sample-math";

// -----------------------------------------------------------------------------
// Pure chart geometry for the breath-test line chart (H2, CH4, H2+CH4 over time).
// No React, no DOM, no dependencies — consumed by both the on-screen SVG
// component and the PDF renderer so the plotted geometry is identical.
//
// Design (per dataviz method): one y-axis (all series share ppm), categorical
// slots 1–3 (validated), direct labels on every line (relief for the sub-3:1
// aqua/yellow contrast), recessive grid.
// -----------------------------------------------------------------------------

export interface ChartSampleInput {
  sampleNumber: number;
  timeMinutes: number;
  h2Ppm: number | null;
  ch4Ppm: number | null;
  skipped: boolean;
}

export interface Pt {
  x: number;
  y: number;
  value: number;
  sampleNumber: number;
}

export type SeriesKey = "h2" | "ch4" | "combined";

/** CH₄ trigger/reference line is fixed (absolute ppm), per clinical requirement. */
export const CH4_TRIGGER_PPM = 10;

export interface SeriesGeometry {
  key: SeriesKey;
  label: string;
  colorLight: string;
  colorDark: string;
  points: Pt[];
  last: Pt | null;
}

// A horizontal reference line. The RED trigger line (baseline + threshold) is the
// clinically important one; the green baseline line gives it context so the
// "rise from baseline" is visible (mirrors the standard breath-test report).
export interface TriggerLine {
  key: string;
  value: number; // ppm value the line sits at
  y: number; // plotted y-coordinate
  label: string;
  color: string; // stroke color (red for trigger, green for baseline)
  emphasized: boolean; // true = the trigger line (thicker, solid)
}

export interface ChartGeometry {
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
  xTicks: Array<{ value: number; x: number }>;
  yTicks: Array<{ value: number; y: number }>;
  series: SeriesGeometry[];
  triggerLines: TriggerLine[];
  hasData: boolean;
  yUnit: string;
  xUnit: string;
}

const SERIES_META: Array<Pick<SeriesGeometry, "key" | "label" | "colorLight" | "colorDark">> = [
  { key: "h2", label: "H₂", colorLight: "#2a78d6", colorDark: "#3987e5" },
  { key: "ch4", label: "CH₄", colorLight: "#1baf7a", colorDark: "#199e70" },
  { key: "combined", label: "H₂+CH₄", colorLight: "#eda100", colorDark: "#c98500" },
];

/** Round a max value up to a "nice" axis bound (1/2/2.5/5 × 10ⁿ). */
function niceMax(max: number): number {
  if (max <= 0) return 10;
  const exp = Math.floor(Math.log10(max));
  const base = Math.pow(10, exp);
  const frac = max / base;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return niceFrac * base;
}

export interface ChartOptions {
  width?: number;
  height?: number;
  /** Which series to plot. Defaults to H₂ + CH₄ (combined is charted only when
   *  explicitly requested; it always remains in the sample table). */
  series?: SeriesKey[];
  /** H2 rise-from-baseline threshold (ppm). When set (and a baseline exists) and
   *  H₂ is plotted, a red trigger line is drawn at baseline + this value. */
  h2RiseThreshold?: number | null;
  /** Absolute CH₄ trigger line (ppm). When set and CH₄ is plotted, a red
   *  reference line is drawn at this fixed value. */
  ch4Threshold?: number | null;
}

const TRIGGER_COLOR = "#dc2626"; // red — the key line
const BASELINE_COLOR = "#16a34a"; // green — baseline context

export function buildChartGeometry(
  samples: ChartSampleInput[],
  opts: ChartOptions = {}
): ChartGeometry {
  const width = opts.width ?? 640;
  const height = opts.height ?? 320;
  const plot = { left: 48, right: 64, top: 16, bottom: 40 };

  // Which series to plot (default: H₂ + CH₄, no combined line on the chart).
  const seriesKeys = opts.series ?? ["h2", "ch4"];
  const activeMetas = SERIES_META.filter((m) => seriesKeys.includes(m.key));
  const plotH2 = seriesKeys.includes("h2");
  const plotCh4 = seriesKeys.includes("ch4");

  const active = samples
    .filter((s) => !s.skipped)
    .sort((a, b) => a.sampleNumber - b.sampleNumber);

  // Baseline H2 = first (earliest) non-null H2 reading — same definition the
  // interpretation engine uses. H₂ trigger sits at baseline + threshold.
  const h2Baseline = active.map((s) => s.h2Ppm).find((v): v is number => v != null) ?? null;
  const h2Threshold = opts.h2RiseThreshold ?? null;
  const h2TriggerValue =
    plotH2 && h2Threshold != null && h2Baseline != null ? h2Baseline + h2Threshold : null;

  // CH₄ trigger is a fixed absolute value (no baseline offset).
  const ch4TriggerValue = plotCh4 && opts.ch4Threshold != null ? opts.ch4Threshold : null;

  const valueFor = (s: ChartSampleInput, key: SeriesGeometry["key"]): number | null => {
    if (key === "h2") return s.h2Ppm;
    if (key === "ch4") return s.ch4Ppm;
    return sampleTotal(s.h2Ppm, s.ch4Ppm);
  };

  const numbers = active.map((s) => s.sampleNumber);
  const minNumber = numbers.length ? Math.min(...numbers) : 0;
  const maxNumber = numbers.length ? Math.max(...numbers) : 1;

  let maxVal = 0;
  for (const s of active) {
    for (const meta of activeMetas) {
      const v = valueFor(s, meta.key);
      if (v != null && v > maxVal) maxVal = v;
    }
  }
  // Keep trigger lines on-chart even when readings never reach them.
  if (h2TriggerValue != null && h2TriggerValue > maxVal) maxVal = h2TriggerValue;
  if (ch4TriggerValue != null && ch4TriggerValue > maxVal) maxVal = ch4TriggerValue;
  const yMax = niceMax(maxVal);

  const innerW = width - plot.left - plot.right;
  const innerH = height - plot.top - plot.bottom;
  const spanNumber = maxNumber - minNumber || 1;

  const xOf = (n: number) => plot.left + ((n - minNumber) / spanNumber) * innerW;
  const yOf = (v: number) => plot.top + innerH - (v / yMax) * innerH;

  const series: SeriesGeometry[] = activeMetas.map((meta) => {
    const points: Pt[] = [];
    for (const s of active) {
      const v = valueFor(s, meta.key);
      if (v == null) continue;
      points.push({ x: xOf(s.sampleNumber), y: yOf(v), value: v, sampleNumber: s.sampleNumber });
    }
    return { ...meta, points, last: points[points.length - 1] ?? null };
  });

  // Y ticks: 5 evenly spaced from 0 to yMax.
  const yTicks = Array.from({ length: 6 }, (_, i) => {
    const value = (yMax / 5) * i;
    return { value, y: yOf(value) };
  });

  // X ticks: one per distinct sample number (deduplicated).
  const uniqueNumbers = Array.from(new Set(numbers));
  const xTicks = uniqueNumbers.map((n) => ({ value: n, x: xOf(n) }));

  // Reference lines. H₂ chart: green baseline + red trigger (baseline + threshold).
  // CH₄ chart: a single fixed red trigger line at the absolute threshold.
  const triggerLines: TriggerLine[] = [];
  if (h2TriggerValue != null && h2Baseline != null) {
    triggerLines.push({
      key: "baseline",
      value: h2Baseline,
      y: yOf(h2Baseline),
      label: `Baseline ${Math.round(h2Baseline)}`,
      color: BASELINE_COLOR,
      emphasized: false,
    });
    triggerLines.push({
      key: "trigger",
      value: h2TriggerValue,
      y: yOf(h2TriggerValue),
      label: `Trigger ${Math.round(h2TriggerValue)}`,
      color: TRIGGER_COLOR,
      emphasized: true,
    });
  }
  if (ch4TriggerValue != null) {
    triggerLines.push({
      key: "ch4-trigger",
      value: ch4TriggerValue,
      y: yOf(ch4TriggerValue),
      label: `Trigger ${Math.round(ch4TriggerValue)}`,
      color: TRIGGER_COLOR,
      emphasized: true,
    });
  }

  return {
    width,
    height,
    plot,
    xTicks,
    yTicks,
    series,
    triggerLines,
    hasData: active.length > 0 && maxVal > 0,
    yUnit: "ppm",
    xUnit: "sample #",
  };
}

/** SVG polyline `points` attribute for a series. */
export function polylinePoints(pts: Pt[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}
