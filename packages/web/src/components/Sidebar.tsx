import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { JobStepper } from "@/components/JobStepper";
import { ProfileName } from "@/components/ProfileName";
import { useDeflexy } from "@/deflexy";
import { useEmployerStats, useProfileId } from "@/hooks";
import { JOB_STATUS, jobStatusVariant } from "@/lib/format";

const usd0 = (v: bigint) => `${Number(formatUnits(v, 6)).toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`;

/** Context-aware right rail: identity always, plus panels relevant to the current page/role. */
export function Sidebar({ tab, jobId }: { tab: string; jobId: bigint | null }) {
  return (
    <div className="space-y-4">
      {jobId !== null ? (
        <>
          <JobStepper jobId={jobId} />
          <JobSidePanel jobId={jobId} />
        </>
      ) : tab === "marketplace" ? (
        <ProtocolPulse />
      ) : null}
    </div>
  );
}

/** On a job page: the client sees their posting summary; everyone else sees "About the client". */
function JobSidePanel({ jobId }: { jobId: bigint }) {
  const deflexy = useDeflexy();
  const { data: myProfileId } = useProfileId();
  const { data: job } = useQuery({
    queryKey: ["job", jobId.toString()], // shared cache with JobDetail — no extra RPC
    enabled: !!deflexy,
    queryFn: async () => ({ id: jobId, ...(await deflexy!.read.getJob(jobId)) }),
  });
  if (!job) return null;
  return myProfileId === job.employerProfileId ? (
    <YourPostingPanel jobId={jobId} status={job.status} budget={job.budget} />
  ) : (
    <ClientCard profileId={job.employerProfileId} />
  );
}

/** Upwork-style "About the client" — trust signals from indexer analytics. */
export function ClientCard({ profileId }: { profileId: bigint }) {
  const { data: s } = useEmployerStats(profileId);
  return (
    <Panel>
      <div className="flex items-center gap-2">
        <Icon icon="solar:user-rounded-bold-duotone" className="text-muted-foreground size-4" />
        <span className="text-sm font-semibold">About the client</span>
        {s?.paymentVerified ? (
          <Badge variant="success" size="xs" className="ml-auto gap-1">
            <Icon icon="solar:verified-check-bold" className="size-3" /> Verified
          </Badge>
        ) : (
          <Badge variant="subtle" size="xs" className="ml-auto">
            New
          </Badge>
        )}
      </div>
      <div className="mt-2 text-sm font-medium">
        <ProfileName profileId={profileId} prefix="Client" />
      </div>
      <div className="mt-3 space-y-2.5">
        <Row icon="solar:card-2-outline" label="Payment" value={s?.paymentVerified ? "Verified" : "Unverified"} />
        <Row icon="solar:shop-outline" label="Jobs posted" value={s ? s.posted : "—"} />
        <Row icon="solar:hand-shake-outline" label="Hires" value={s ? s.hires : "—"} />
        <Row icon="solar:check-circle-outline" label="Completed" value={s ? s.completed : "—"} />
        <Row icon="solar:wallet-money-outline" label="In escrow" value={s ? usd0(s.escrow) : "—"} />
      </div>
    </Panel>
  );
}

/** Shown to the employer viewing their own posting. */
function YourPostingPanel({ jobId, status, budget }: { jobId: bigint; status: number; budget: bigint }) {
  const deflexy = useDeflexy();
  const { data: bids } = useQuery({
    queryKey: ["bids", jobId.toString()],
    enabled: !!deflexy,
    queryFn: () => deflexy!.read.listBids(jobId),
  });
  return (
    <Panel>
      <div className="flex items-center gap-2">
        <Icon icon="solar:posts-carousel-vertical-bold-duotone" className="text-muted-foreground size-4" />
        <span className="text-sm font-semibold">Your posting</span>
        <Badge variant={jobStatusVariant(status)} size="xs" className="ml-auto">
          {JOB_STATUS[status]}
        </Badge>
      </div>
      <div className="mt-3 space-y-2.5">
        <Row icon="solar:users-group-rounded-outline" label="Proposals" value={bids?.length ?? "—"} />
        <Row icon="solar:wallet-money-outline" label="Budget" value={usd0(budget)} />
      </div>
      <p className="text-muted-foreground mt-3 text-xs">Review proposals in the job view and accept one to start.</p>
    </Panel>
  );
}

/** Marketplace overview while browsing the feed. */
function ProtocolPulse() {
  const deflexy = useDeflexy();
  const { data } = useQuery({
    queryKey: ["stats"], // shared with Analytics
    enabled: !!deflexy,
    queryFn: () => deflexy!.query.protocolStats(),
    refetchInterval: 10000,
  });
  if (!data) return null;
  return (
    <Panel>
      <div className="flex items-center gap-2">
        <Icon icon="solar:pulse-bold-duotone" className="text-muted-foreground size-4" />
        <span className="text-sm font-semibold">Marketplace</span>
      </div>
      <div className="mt-3 space-y-2.5">
        <Row icon="solar:bolt-circle-outline" label="Open jobs" value={data.openJobs} />
        <Row icon="solar:case-minimalistic-outline" label="Total jobs" value={data.jobs} />
        <Row icon="solar:users-group-rounded-outline" label="Profiles" value={data.profiles} />
        <Row icon="solar:wallet-money-outline" label="Escrowed" value={usd0(data.totalDeposited)} />
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="bg-card rounded-2xl border p-4 shadow-xs">{children}</div>;
}

function Row({ icon, label, value }: { icon: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon icon={icon} className="text-muted-foreground size-4 shrink-0" />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium">{value}</span>
    </div>
  );
}
