import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { JobListRow } from "@/components/JobRow";
import { useDeflexy } from "@/deflexy";
import { useBrief, useProfileId } from "@/hooks";
import { JOB_STATUS, MODELS, jobStatusVariant, type JobItem } from "@/lib/format";

/** Buyer/client view: jobs you've posted. */
export function MyJobs({ onSelect }: { onSelect: (jobId: bigint) => void }) {
  const deflexy = useDeflexy();
  const { data: profileId } = useProfileId();
  const hasProfile = !!profileId && profileId !== 0n;

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["myJobs", profileId?.toString()],
    enabled: !!deflexy && hasProfile,
    queryFn: async () =>
      ((await deflexy!.read.listJobs(100)) as JobItem[])
        .filter((j) => j.employerProfileId === profileId)
        .sort((a, b) => Number(b.id - a.id)),
    refetchInterval: 8000,
  });

  if (profileId !== undefined && !hasProfile) {
    return <Empty icon="solar:user-plus-outline" text="Create a profile (Profile tab) to post and manage jobs." />;
  }

  const open = jobs?.filter((j) => j.status === 1).length ?? 0;

  return (
    <div className="space-y-4">
 

      {isLoading || !jobs ? (
        <ListSkeleton />
      ) : jobs.length === 0 ? (
        <Empty icon="solar:shop-outline" text="You haven't posted any jobs yet. Use “Create Job” to start." />
      ) : (
        <div className="border-border bg-card divide-border overflow-hidden rounded border shadow-xs divide-y">
          {jobs.map((j) => (
            <JobRow key={j.id.toString()} job={j} onSelect={() => onSelect(j.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({ job, onSelect }: { job: JobItem; onSelect: () => void }) {
  const { data: brief } = useBrief(job.metadataCID);
  return (
    <JobListRow
      title={brief?.title ?? (MODELS[job.model] ?? String(job.model))}
      timestamp={job.createdAt}
      description={brief?.description}
      onSelect={onSelect}
      badges={
        <>
          <Badge variant={jobStatusVariant(job.status)} className="shrink-0">
            {JOB_STATUS[job.status]}
          </Badge>
          <Badge variant="subtle" className="shrink-0">
            {MODELS[job.model] ?? job.model}
          </Badge>
          <Badge variant="secondary" className="shrink-0 font-mono">
            {formatUnits(job.budget, 6)} USDC
          </Badge>
        </>
      }
    />
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
