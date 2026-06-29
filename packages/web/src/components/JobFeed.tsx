import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, type Address, type Hex } from "viem";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { useDeflexy } from "@/deflexy";
import { useEmployerStats, useProfileId, useTx } from "@/hooks";
import { fetchBrief, isEmptyCid } from "@/lib/ipfs";
import { JOB_STATUS, MODELS, jobStatusVariant, type JobItem } from "@/lib/format";

interface IndexerJob {
  id: string;
  employerProfileId: string;
  budget: string;
  paymentToken: string;
  model: number;
  status: number;
  metadataCID: string;
  createdAt: string;
}

const mapJob = (r: IndexerJob): JobItem => ({
  id: BigInt(r.id),
  employerProfileId: BigInt(r.employerProfileId),
  paymentToken: r.paymentToken as Address,
  budget: BigInt(r.budget),
  model: r.model,
  status: r.status,
  metadataCID: r.metadataCID as Hex,
  createdAt: BigInt(r.createdAt),
});

export function JobFeed({ onSelect }: { onSelect: (jobId: bigint) => void }) {
  const deflexy = useDeflexy();
  const { isConnected } = useAccount();
  const { data: myProfileId } = useProfileId();
  const tx = useTx();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs"],
    enabled: !!deflexy,
    queryFn: async (): Promise<JobItem[]> => {
      try {
        const res = (await deflexy!.query.allJobs(50)) as { jobs: { items: IndexerJob[] } };
        return res.jobs.items.map(mapJob);
      } catch {
        return deflexy!.read.listJobs(50) as Promise<JobItem[]>;
      }
    },
    refetchInterval: 5000,
  });

  // Open jobs only, newest first.
  const open = useMemo(
    () => [...(data ?? [])].filter((j) => j.status === 1).sort((a, b) => Number(b.id - a.id)),
    [data],
  );

  // Titles are searchable: fetch each open job's brief (cached, immutable).
  const briefs = useQueries({
    queries: open.map((j) => ({
      queryKey: ["brief", j.metadataCID],
      queryFn: () => fetchBrief(j.metadataCID),
      enabled: isConnected && !isEmptyCid(j.metadataCID),
      staleTime: Infinity,
      gcTime: Infinity,
      retry: 1,
    })),
  });

  const term = search.trim().toLowerCase();
  const rows = open
    .map((job, i) => ({ job, title: briefs[i]?.data?.title ?? "", description: briefs[i]?.data?.description ?? "" }))
    .filter(
      ({ job, title }) =>
        !term ||
        title.toLowerCase().includes(term) ||
        (MODELS[job.model] ?? "").toLowerCase().includes(term) ||
        `#${job.id}`.includes(term),
    );

  async function cancel(jobId: bigint) {
    if (!deflexy || !window.confirm("Cancel this job? This can't be undone.")) return;
    // Optimistic: drop it from the feed immediately; restore if the tx fails.
    const prev = qc.getQueryData<JobItem[]>(["jobs"]);
    qc.setQueryData<JobItem[]>(["jobs"], (old) => old?.filter((j) => j.id !== jobId));
    const ok = await tx.run(() => deflexy.write.cancelJob(jobId), [["jobs"], ["myJobs"]], "Job cancelled");
    if (!ok && prev) qc.setQueryData(["jobs"], prev);
  }

  return (
    <div className="space-y-4">
      {/* Search header */}
      <div className="relative">
        <Icon
          icon="solar:magnifer-linear"
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search open jobs…"
          className="border-input bg-card focus:ring-primary/30 h-10 w-full rounded-xl border pr-9 pl-9 text-sm outline-none focus:ring-2"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
          >
            <Icon icon="solar:close-circle-bold" className="size-4" />
          </button>
        )}
      </div>


      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-surface/60 h-[58px] animate-pulse rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">Failed to load jobs.</p>
      ) : rows.length === 0 ? (
        <div className="border-border/60 text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-sm">
          <Icon icon="solar:case-minimalistic-outline" className="size-5 opacity-50" />
          {term ? "No open jobs match your search." : "No open jobs right now."}
        </div>
      ) : (
        <div className="border-border bg-card divide-border overflow-hidden rounded border shadow-xs divide-y">
          {rows.map(({ job, title, description }) => (
            <JobRow
              key={job.id.toString()}
              job={job}
              title={title}
              description={description}
              isOwner={myProfileId !== undefined && job.employerProfileId === myProfileId}
              canceling={tx.busy}
              onSelect={() => onSelect(job.id)}
              onCancel={() => cancel(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({
  job,
  title,
  description,
  isOwner,
  canceling,
  onSelect,
  onCancel,
}: {
  job: JobItem;
  title: string;
  description: string;
  isOwner: boolean;
  canceling: boolean;
  onSelect: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="hover:bg-accent group flex items-center gap-3 px-3 py-2.5 transition-colors">
      <button onClick={onSelect} className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left">
        <span className="w-full truncate text-md font-medium">{title || (MODELS[job.model] ?? job.model)}</span>
        {description && <span className="text-muted-foreground line-clamp-1 w-full text-xs">{description}</span>}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={jobStatusVariant(job.status)} className="shrink-0"  >
            {JOB_STATUS[job.status]}
          </Badge>
          <Badge variant="subtle" className="shrink-0">
            {MODELS[job.model] ?? job.model}
          </Badge>
          <EmployerBadges profileId={job.employerProfileId} />
        </div>
      </button>
      <span className="font-mono text-sm font-medium">{formatUnits(job.budget, 6)} USDC</span>
      {isOwner && (
        <button
          onClick={onCancel}
          disabled={canceling}
          title="Cancel job"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md p-1.5 opacity-0 transition group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
        >
          <Icon icon="solar:trash-bin-trash-outline" className="size-4" />
        </button>
      )}
      <Icon
        icon="solar:alt-arrow-right-linear"
        className="text-muted-foreground/50 size-4 shrink-0"
      />
    </div>
  );
}

/** Icon-only employer trust signals from indexer analytics (no fabricated star rating). */
function EmployerBadges({ profileId }: { profileId: bigint }) {
  const { data: s } = useEmployerStats(profileId);
  if (!s) return null;
  return (
    <div className="text-muted-foreground flex items-center gap-2">
      {s.paymentVerified ? (
        <span title="Payment verified" className="text-success inline-flex">
          <Icon icon="solar:verified-check-bold" className="size-3.5" />
        </span>
      ) : (
        <span title="New employer" className="inline-flex">
          <Icon icon="solar:stars-bold" className="size-3.5" />
        </span>
      )}
      {s.hires > 0 && <Stat icon="solar:case-minimalistic-bold" value={s.hires} title={`${s.hires} hires`} />}
      {s.completed > 0 && (
        <Stat icon="solar:check-circle-bold" value={s.completed} title={`${s.completed} jobs completed`} />
      )}
      {s.escrow > 0n && (
        <Stat
          icon="solar:wallet-money-bold"
          value={Number(formatUnits(s.escrow, 6)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          title={`${formatUnits(s.escrow, 6)} USDC in escrow`}
        />
      )}
    </div>
  );
}

function Stat({ icon, value, title }: { icon: string; value: number | string; title: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-0.5 text-xs tabular-nums">
      <Icon icon={icon} className="size-3" />
      {value}
    </span>
  );
}
