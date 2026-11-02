import { formatMoney, formatMoneyShort } from "@/lib/money";

interface Bar {
  key: string;
  label: string;
  value: number;
  /** Highlighted bar, e.g. today or the selected month. */
  active?: boolean;
  /** Full description for the tooltip. */
  title?: string;
}

/**
 * Plain SVG bar chart - no chart library, renders on the server, so the
 * dashboard has no client-side JavaScript for its charts at all.
 */
export function BarChart({
  bars,
  height = 160,
  labelEvery = 1,
  average,
}: {
  bars: Bar[];
  height?: number;
  labelEvery?: number;
  /** Optional dashed reference line. */
  average?: number;
}) {
  const max = Math.max(...bars.map((b) => b.value), average ?? 0, 1);
  const width = 100 / bars.length;
  const chartHeight = height - 22;

  return (
    <figure>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img"
        aria-label={`Wykres: ${bars.map((b) => `${b.label} ${formatMoney(b.value)}`).join(", ")}`}>
        {bars.map((bar, i) => {
          const h = (bar.value / max) * chartHeight;
          return (
            <g key={bar.key}>
              <title>{bar.title ?? `${bar.label}: ${formatMoney(bar.value)}`}</title>
              {/* Full-height hit area so small bars are easy to hover */}
              <rect x={i * width} y={0} width={width} height={chartHeight} fill="transparent" />
              <rect
                x={i * width + width * 0.15}
                y={chartHeight - h}
                width={width * 0.7}
                height={Math.max(h, bar.value > 0 ? 1 : 0)}
                rx={Math.min(width * 0.2, 1.2)}
                className={bar.active ? "fill-accent" : "fill-accent/35"}
              />
            </g>
          );
        })}
        {average !== undefined && average > 0 && (
          <line x1={0} x2={100} y1={chartHeight - (average / max) * chartHeight} y2={chartHeight - (average / max) * chartHeight}
            className="stroke-fg-muted" strokeWidth={0.6} strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      <div className="relative mt-1 h-4 text-[10px] text-fg-muted">
        {bars.map((bar, i) =>
          i % labelEvery === 0 ? (
            <span key={bar.key} className="absolute -translate-x-1/2 whitespace-nowrap tabular" style={{ left: `${(i + 0.5) * width}%` }}>
              {bar.label}
            </span>
          ) : null,
        )}
      </div>
      <figcaption className="sr-only">Maksimum {formatMoneyShort(max)}</figcaption>
    </figure>
  );
}
