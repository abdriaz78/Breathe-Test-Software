import React from "react";
import { Svg, Line, Polyline, Circle, Text as SvgText, Rect } from "@react-pdf/renderer";
import {
  buildChartGeometry,
  polylinePoints,
  type ChartSampleInput,
  type SeriesKey,
} from "@/lib/chart-geometry";

// PDF chart — same geometry as the on-screen chart, drawn with react-pdf SVG
// primitives. Uses the light-mode validated palette and ASCII series labels
// (H2 / CH4 / H2+CH4) so standard PDF fonts render every glyph.

const LABEL: Record<string, string> = {
  h2: "H2",
  ch4: "CH4",
  combined: "H2+CH4",
};

const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";
const MUTED = "#898781";

export function ReportChart({
  samples,
  h2RiseThreshold,
  ch4Threshold,
  series,
  width = 520,
  height = 240,
}: {
  samples: ChartSampleInput[];
  h2RiseThreshold?: number | null;
  ch4Threshold?: number | null;
  series?: SeriesKey[];
  width?: number;
  height?: number;
}) {
  const g = buildChartGeometry(samples, { width, height, h2RiseThreshold, ch4Threshold, series });
  if (!g.hasData) return null;

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill="#ffffff" />

      {/* Y gridlines + labels */}
      {g.yTicks.map((t, i) => (
        <Line
          key={`yl${i}`}
          x1={g.plot.left}
          y1={t.y}
          x2={g.width - g.plot.right}
          y2={t.y}
          strokeWidth={0.5}
          stroke={GRID}
        />
      ))}
      {g.yTicks.map((t, i) => (
        <SvgText
          key={`yt${i}`}
          x={g.plot.left - 6}
          y={t.y + 3}
          style={{ fontSize: 8 }}
          fill={MUTED}
          textAnchor="end"
        >
          {String(Math.round(t.value))}
        </SvgText>
      ))}

      {/* X labels */}
      {g.xTicks.map((t, i) => (
        <SvgText
          key={`xt${i}`}
          x={t.x}
          y={g.height - g.plot.bottom + 14}
          style={{ fontSize: 8 }}
          fill={MUTED}
          textAnchor="middle"
        >
          {String(t.value)}
        </SvgText>
      ))}

      {/* Axis titles */}
      <SvgText x={g.plot.left - 6} y={g.plot.top - 4} style={{ fontSize: 8 }} fill={MUTED} textAnchor="start">
        ppm
      </SvgText>
      <SvgText
        x={(g.plot.left + g.width - g.plot.right) / 2}
        y={g.height - 2}
        style={{ fontSize: 8 }}
        fill={MUTED}
        textAnchor="middle"
      >
        time (min)
      </SvgText>

      {/* Left axis */}
      <Line x1={g.plot.left} y1={g.plot.top} x2={g.plot.left} y2={g.height - g.plot.bottom} strokeWidth={0.75} stroke={AXIS} />

      {/* Reference lines: green baseline + RED trigger line (baseline + threshold). */}
      {g.triggerLines.map((t) => (
        <React.Fragment key={t.key}>
          <Line
            x1={g.plot.left}
            y1={t.y}
            x2={g.width - g.plot.right}
            y2={t.y}
            strokeWidth={t.emphasized ? 1.5 : 1}
            stroke={t.color}
            strokeDasharray={t.emphasized ? undefined : "3 3"}
          />
          <SvgText
            x={g.width - g.plot.right + 3}
            y={t.y + 3}
            style={{ fontSize: 7 }}
            fill={t.color}
            textAnchor="start"
          >
            {`${t.label}`}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Series */}
      {g.series.map((s) => {
        if (s.points.length === 0) return null;
        return (
          <React.Fragment key={s.key}>
            {s.points.length > 1 && (
              <Polyline
                points={polylinePoints(s.points)}
                fill="none"
                stroke={s.colorLight}
                strokeWidth={1.5}
              />
            )}
            {s.points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={2} fill={s.colorLight} />
            ))}
            {s.last && (
              <SvgText
                x={s.last.x + 4}
                y={s.last.y + 3}
                style={{ fontSize: 8 }}
                fill={s.colorLight}
              >
                {LABEL[s.key]}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
