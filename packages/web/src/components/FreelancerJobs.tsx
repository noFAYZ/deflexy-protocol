import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { useDeflexy } from "@/deflexy";
import { useBrief, useProfileId } from "@/hooks";
import { MODELS, timeAgo, type JobItem } from "@/lib/format";

const AGR_STATUS = ["None", "Active", "Disputed", "Resolved", "Completed", "Terminated"];
const agrVariant = (s: number): "success" | "info" | "warning" | "danger" | "secondary" =>
  s === 1 ? "success" : s === 4 ? "info" : s === 2 ? "warning" : s === 5 ? "danger" : "secondary";

interface Agr {
  id: string;
  status: number;
  totalAmount: string;
  model: number;
  jobId: string;
  vaultId: string;
}

/** Freelancer view: jobs you've been hired for (agreements) — accepted + completed. */
export function FreelancerJobs({ onSelect }: { onSelect: (jobId: bigint) => void }) {
  const deflexy = useDeflexy();
  const { data: profileId } = useProfileId();
  const hasProfile = !!profileId && profileId !== 0n;

  const { data: agreements, isLoading, isError } = useQuery({
    queryKey: ["agreementsByFreelancer", profileId?.toString()],
    enabled: !!deflexy && hasProfile,
    retry: false,
    refetchInterval: 8000,
    queryFn: async () => {
      const d = (await deflexy!.query.agreementsByFreelancer(profileId!)) as { agreements: { items: Agr[] } };
      return d.agreements.items.sort((a, b) => Number(BigInt(b.id) - BigInt(a.id)));
    },
  });

  // Job metadata (title/budget) — shares the feed's cache, no extra RPC.
  const { data: jobs } = useQuery({
    queryKey: ["jobs"],
    enabled: !!deflexy && hasProfile,
    queryFn: () => deflexy!.read.listJobs(50) as Promise<JobItem[]>,
  });
  const jobMap = new Map((jobs ?? []).map((j) => [j.id.toString(), j]));

  if (profileId !== undefined && !hasProfile) {
    return <Empty icon="solar:user-plus-outline" text="Create a profile (Profile menu) to take on jobs." />;
  }

  const activeCount = agreements?.filter((a) => a.status === 1).length ?? 0;
  const completedCount = agreements?.filter((a) => a.status === 4).length ?? 0;

  return (
    <div className="space-y-4">
   

      {isError ? (
        <Empty icon="solar:cloud-cross-outline" text="Indexer offline — your jobs are unavailable." />
      ) : isLoading || !agreements ? (
        <ListSkeleton />
      ) : agreements.length === 0 ? (
        <Empty icon="solar:case-minimalistic-outline" text="No accepted jobs yet. Apply to one from Find Jobs." />
      ) : (
        <div className="border-border bg-card divide-border overflow-hidden rounded border shadow-xs divide-y">
          {agreements.map((a) => (
            <AgrRow key={a.id} agr={a} job={jobMap.get(a.jobId)} onSelect={() => onSelect(BigInt(a.jobId))} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgrRow({ agr, job, onSelect }: { agr: Agr; job?: JobItem; onSelect: () => void }) {
  const { data: brief } = useBrief(job?.metadataCID);
  return (
    <button
      onClick={onSelect}
      className="hover:bg-accent group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <div className="min-w-0 flex-1 truncate text-md font-medium">{brief?.title ?? `Job #${agr.jobId}`}</div>
          {job && <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{timeAgo(job.createdAt)}</span>}
        </div>
        {brief?.description && <div className="text-muted-foreground line-clamp-1 text-xs">{brief.description}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant={agrVariant(agr.status)} className="shrink-0">
            {AGR_STATUS[agr.status]}
          </Badge>
          <Badge variant="subtle" className="shrink-0">
            {MODELS[agr.model] ?? agr.model}
          </Badge>
          <Badge variant="secondary" className="shrink-0 font-mono">
            {formatUnits(BigInt(agr.totalAmount), 6)} USDC
          </Badge>
        </div>
      </div>
      <Icon icon="solar:alt-arrow-right-linear" className="text-muted-foreground/50 size-4 shrink-0" />
    </button>
  );
}

const ListSkeleton = () => (
  <div className="space-y-2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="bg-surface/60 h-[58px] animate-pulse rounded-xl" />
    ))}
  </div>
);

const Empty = ({ icon, text }: { icon: string; text: string }) => (
  <div className="border-border/60 text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center text-sm">
    <Icon icon={icon} className="size-6 opacity-50" />
    {text}
  </div>
);
