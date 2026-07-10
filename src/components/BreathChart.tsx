import {
  buildChartGeometry,
  polylinePoints,
  type ChartSampleInput,
} from "@/lib/chart-geometry";

// -----------------------------------------------------------------------------
// On-screen breath-test chart (inline SVG, no client JS so it renders in the
// PDF pipeline unchanged in spirit). Colors come from the validated categorical
// palette; every line is direct-labeled at its end (relief for sub-3:1 hues),
// and a legend is always present. Theme-aware via CSS custom properties.
// -----------------------------------------------------------------------------

export function BreathChart({
  samples,
  h2RiseThreshold,
  width = 640,
  height = 320,
}: {
  samples: ChartSampleInput[];
  h2RiseThreshold?: number | null;
  width?: number;
  height?: number;
}) {
  const g = buildChartGeometry(samples, { width, height, h2RiseThreshold });

  if (!g.hasData) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-clinical-border text-sm text-slate-400">
        No sample data to chart yet.
      </div>
    );
  }

  const gridColor = "var(--chart-grid, #e1e0d9)";
  const axisColor = "var(--chart-axis, #c3c2b7)";
  const textColor = "var(--chart-muted, #898781)";

  return (
    <figure className="chart-root">
      <svg
        viewBox={`0 0 ${g.width} ${g.height}`}
        width="100%"
        role="img"
        aria-label="Breath test: H2, CH4, and H2+CH4 in ppm over time"
        style={{ maxWidth: g.width, height: "auto" }}
      >
        {/* Y gridlines + labels */}
        {g.yTicks.map((t, i) => (
          <g key={`y${i}`}>
            <line
              x1={g.plot.left}
              x2={g.width - g.plot.right}
              y1={t.y}
              y2={t.y}
              stroke={gridColor}
              strokeWidth={1}
            />
            <text
              x={g.plot.left - 8}
              y={t.y + 3}
              textAnchor="end"
              fontSize={10}
              fill={textColor}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round(t.value)}
            </text>
          </g>
        ))}

        {/* X axis ticks + labels */}
        {g.xTicks.map((t, i) => (
          <text
            key={`x${i}`}
            x={t.x}
            y={g.height - g.plot.bottom + 16}
            textAnchor="middle"
            fontSize={10}
            fill={textColor}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {t.value}
          </text>
        ))}

        {/* Axis titles */}
        <text
          x={g.plot.left - 34}
          y={g.plot.top + (g.height - g.plot.top - g.plot.bottom) / 2}
          fontSize={10}
          fill={textColor}
          textAnchor="middle"
          transform={`rotate(-90 ${g.plot.left - 34} ${g.plot.top + (g.height - g.plot.top - g.plot.bottom) / 2})`}
        >
          {g.yUnit}
        </text>
        <text
          x={(g.plot.left + g.width - g.plot.right) / 2}
          y={g.height - 4}
          fontSize={10}
          fill={textColor}
          textAnchor="middle"
        >
          time ({g.xUnit})
        </text>

        {/* Left axis */}
        <line
          x1={g.plot.left}
          x2={g.plot.left}
          y1={g.plot.top}
          y2={g.height - g.plot.bottom}
          stroke={axisColor}
          strokeWidth={1}
        />

        {/* Reference lines: green baseline + RED trigger line (the key one).
            Drawn under the data so the reaction line reads on top of it. */}
        {g.triggerLines.map((t) => (
          <g key={t.key}>
            <line
              x1={g.plot.left}
              x2={g.width - g.plot.right}
              y1={t.y}
              y2={t.y}
              stroke={t.color}
              strokeWidth={t.emphasized ? 2 : 1.25}
              strokeDasharray={t.emphasized ? undefined : "5 4"}
            />
            <text
              x={g.width - g.plot.right + 4}
              y={t.y + 3}
              fontSize={9}
              fontWeight={t.emphasized ? 700 : 500}
              fill={t.color}
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* Series lines + markers + end labels */}
        {g.series.map((s) => {
          if (s.points.length === 0) return null;
          const color = `var(--series-${s.key}, ${s.colorLight})`;
          return (
            <g key={s.key}>
              {s.points.length > 1 && (
                <polyline
                  points={polylinePoints(s.points)}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {s.points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
              ))}
              {s.last && (
                <text
                  x={s.last.x + 6}
                  y={s.last.y + 3}
                  fontSize={10}
                  fontWeight={600}
                  fill={color}
                >
                  {s.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend (always present for ≥2 series) */}
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
        {g.series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: `var(--series-${s.key}, ${s.colorLight})` }}
            />
            {s.label}
          </span>
        ))}
        {g.triggerLines.map((t) => (
          <span
            key={t.key}
            className={`inline-flex items-center gap-1.5 ${t.emphasized ? "font-semibold" : ""}`}
            style={{ color: t.color }}
          >
            <span className="inline-block h-0.5 w-4" style={{ background: t.color }} />
            {t.label} ppm
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
