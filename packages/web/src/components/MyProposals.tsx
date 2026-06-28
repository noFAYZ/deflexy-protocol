import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Hex } from "viem";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
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
      <div>
        <h2 className="text-lg font-semibold tracking-tight">My Proposals</h2>
        <p className="text-muted-foreground text-xs">{bids ? `${bids.length} submitted` : "Jobs you've bid on"}</p>
      </div>

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
    <button
      onClick={onSelect}
      className="hover:bg-surface/70 group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{brief?.title ?? `Job #${bid.jobId}`}</div>
        <div className="mt-1">
          <Badge variant={bidVariant(bid.status)} className="shrink-0">
            {BID_STATUS[bid.status]}
          </Badge>
        </div>
      </div>
      <span className="font-mono text-sm font-medium">{formatUnits(bid.amount, 6)} USDC</span>
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
