import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Hex } from "viem";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { JobListRow } from "@/components/JobRow";
import { useDeflexy } from "@/deflexy";
import { useBrief, useProfileId } from "@/hooks";

const BID_STATUS = ["None", "Submitted", "Accepted", "Withdrawn", "Rejected"];
const bidVariant = (s: number): "warning" | "success" | "danger" | "secondary" =>
  s === 1 ? "warning" : s === 2 ? "success" : s === 4 ? "danger" : "secondary";

interface Bid {
  id: bigint;
  jobId: bigint;
  amount: bigint;
  status: number;
}

/** Seller/freelancer view: jobs you've submitted proposals on. */
export function MyProposals({ onSelect }: { onSelect: (jobId: bigint) => void }) {
  const deflexy = useDeflexy();
  const { data: profileId } = useProfileId();
  const hasProfile = !!profileId && profileId !== 0n;

  const { data: bids, isLoading } = useQuery({
    queryKey: ["myBids", profileId?.toString()],
    enabled: !!deflexy && hasProfile,
    queryFn: async () => (await deflexy!.read.listBids()).filter((b) => b.freelancerProfileId === profileId),
    refetchInterval: 8000,
  });

  if (profileId !== undefined && !hasProfile) {
    return <Empty icon="solar:user-plus-outline" text="Create a profile (Profile tab) to bid on jobs." />;
  }

  return (
    <div className="space-y-4">
 

      {isLoading || !bids ? (
        <ListSkeleton />
      ) : bids.length === 0 ? (
        <Empty icon="solar:hand-shake-outline" text="You haven't submitted any proposals yet. Browse the Marketplace to apply." />
      ) : (
        <div className="border-border bg-card divide-border overflow-hidden rounded-xl border shadow-xs divide-y">
          {bids.map((b) => (
            <ProposalRow key={b.id.toString()} bid={b} onSelect={() => onSelect(b.jobId)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalRow({ bid, onSelect }: { bid: Bid; onSelect: () => void }) {
  const deflexy = useDeflexy();
  const { data: job } = useQuery({
    queryKey: ["job", bid.jobId.toString()], // shared cache with JobDetail
    enabled: !!deflexy,
    queryFn: async () => ({ id: bid.jobId, ...(await deflexy!.read.getJob(bid.jobId)) }),
  });
  const { data: brief } = useBrief(job?.metadataCID as Hex | undefined);

  return (
    <JobListRow
      title={brief?.title ?? `Job #${bid.jobId}`}
      description={brief?.description}
      onSelect={onSelect}
      badges={
        <>
          <Badge variant={bidVariant(bid.status)} className="shrink-0">
            {BID_STATUS[bid.status]}
          </Badge>
          <Badge variant="secondary" className="shrink-0 font-mono">
            {formatUnits(bid.amount, 6)} USDC
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
