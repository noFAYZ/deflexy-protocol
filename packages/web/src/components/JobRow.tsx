import { type ReactNode } from "react";
import { timeAgo } from "@/lib/format";
import { Badge } from "./ui/badge";

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
  tags,
  onSelect,
}: {
  title: string;
  timestamp?: bigint;
  description?: string;
  badges?: ReactNode;
  tags?: string[];
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="hover:bg-accent group flex w-full flex-col items-start gap-2.5 p-4  text-left transition-colors"
    >
      <div className="flex w-full items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-lg font-medium">{title}</span>
        {timestamp !== undefined && (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{timeAgo(timestamp)}</span>
        )}
      </div>
      {badges && <div className="flex flex-wrap items-center gap-1.5">{badges}</div>}
      {description && <p className="text-muted-foreground line-clamp-2 w-full text-sm">{description}</p>}
      {!!tags?.length && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {tags.map((t) => (
            <Badge variant={'info'} className="font-sans capitalize text-muted-foreground" key={t}>{t}</Badge>
          ))}
        </div>
      )}
    </button>
  );
}
