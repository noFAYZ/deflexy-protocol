import { type ReactNode } from "react";

// Design-token colors for charts (see index.css @theme).
export const CHART = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  info: "var(--color-info)",
  warning: "var(--color-warning)",
  destructive: "var(--color-destructive)",
  muted: "var(--muted-foreground)",
};

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/** SVG ring chart with a value in the center. */
export function Donut({
  segments,
  size = 132,
  thickness = 14,
  centerValue,
  centerLabel,
}: {
  segments: Segment[];
  size?: number;
  thickness?: number;
  centerValue?: ReactNode;
  centerLabel?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.value / total) * circ;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-acc}
              />
            );
            acc += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold tracking-tight">{centerValue}</div>
        {centerLabel && (
          <div className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">{centerLabel}</div>
        )}
      </div>
    </div>
  );
}

/** Color-keyed legend with values, pairs with Donut/SegmentBar. */
export function Legend({ items }: { items: { label: string; value: ReactNode; color: string }[] }) {
  return (
    <div className="min-w-0 flex-1 space-y-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2 text-xs">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: i.color }} />
          <span className="text-muted-foreground truncate">{i.label}</span>
          <span className="ml-auto font-mono font-medium">{i.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Single horizontal stacked bar (e.g. escrow breakdown). */
export function SegmentBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
      {total > 0 &&
        segments.map((s) => (
          <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
    </div>
  );
}

/** Labeled progress-style bar for funnels / leaderboards. */
export function BarRow({
  label,
  value,
  display,
  max,
  color = CHART.primary,
}: {
  label: ReactNode;
  value: number;
  display?: ReactNode;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground truncate">{label}</span>
        <span className="font-mono font-medium">{display ?? value}</span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
