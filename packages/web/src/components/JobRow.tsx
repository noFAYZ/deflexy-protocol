import { type ReactNode } from "react";
import { timeAgo } from "@/lib/format";

/**
 * Shared list row for jobs / agreements / proposals. One design everywhere:
 *   title ───────────────── time ago
 *   [badges…]                          ← below title, above description
 *   one-line description
 * No trailing chevron — the whole row is the click target. Callers pass their
 * own badge set (job status vs agreement status etc.) via `badges`.
 */
export function JobListRow({
  title,
  timestamp,
  description,
  badges,
  onSelect,
}: {
  title: string;
  timestamp?: bigint;
  description?: string;
  badges?: ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="hover:bg-accent group flex w-full flex-col items-start gap-1.5 px-3 py-2.5 text-left transition-colors"
    >
      <div className="flex w-full items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-md font-medium">{title}</span>
        {timestamp !== undefined && (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{timeAgo(timestamp)}</span>
        )}
      </div>
      {badges && <div className="flex flex-wrap items-center gap-1.5">{badges}</div>}
      {description && <p className="text-muted-foreground line-clamp-1 w-full text-xs">{description}</p>}
    </button>
  );
}
