import { formatMoney } from "@/lib/money";

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Share of categories as a ring, with the total in the middle. */
export function Donut({ slices, size = 180, centerLabel }: { slices: Slice[]; size?: number; centerLabel: string }) {
  const totalValue = slices.reduce((s, x) => s + x.value, 0);
  const radius = 15.9155; // circumference = 100, so dash lengths are percentages
  let offset = 25; // start at 12 o'clock

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 42 42" className="size-full -rotate-0" role="img"
        aria-label={slices.map((s) => `${s.label} ${formatMoney(s.value)}`).join(", ")}>
        <circle cx="21" cy="21" r={radius} fill="none" className="stroke-surface-muted" strokeWidth="5" />
        <g className="spin-in">
        {totalValue > 0 &&
          slices.map((slice) => {
            const length = (slice.value / totalValue) * 100;
            const circle = (
              <circle key={slice.key} cx="21" cy="21" r={radius} fill="none" stroke={slice.color} strokeWidth="5"
                strokeDasharray={`${Math.max(length - 0.4, 0.1)} ${100 - Math.max(length - 0.4, 0.1)}`} strokeDashoffset={offset}>
                <title>{`${slice.label}: ${formatMoney(slice.value)} (${Math.round((slice.value / totalValue) * 100)}%)`}</title>
              </circle>
            );
            offset -= length;
            return circle;
          })}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs text-fg-muted">{centerLabel}</span>
        <span className="font-display text-xl font-semibold tabular">{formatMoney(totalValue)}</span>
      </div>
    </div>
  );
}
