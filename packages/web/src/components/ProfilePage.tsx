import { useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, keccak256, toBytes } from "viem";
import { Icon } from "@iconify/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditProfileSheet } from "@/components/EditProfileSheet";
import { DelegatesSheet } from "@/components/DelegatesSheet";
import { useDeflexy, USDC } from "@/deflexy";
import { useProfileId, useProfileMeta, useTx } from "@/hooks";
import { JOB_STATUS, MODELS, jobStatusVariant, short, type JobItem } from "@/lib/format";

const usdc = (v: bigint) => `${formatUnits(v, 6)} USDC`;
const BID_STATUS = ["None", "Submitted", "Accepted", "Withdrawn", "Rejected"];
const AGR_STATUS = ["None", "Active", "Disputed", "Resolved", "Completed", "Terminated"];
const agrVariant = (s: number): "success" | "warning" | "secondary" | "danger" =>
  s === 1 ? "success" : s === 2 ? "warning" : s === 5 ? "danger" : "secondary";

interface Agr { id: string; status: number; totalAmount: string; model: number; jobId: string; role: "Client" | "Freelancer" }
const bidVariant = (s: number): "warning" | "success" | "danger" | "secondary" =>
  s === 1 ? "warning" : s === 2 ? "success" : s === 4 ? "danger" : "secondary";

export function ProfilePage({ onSelect }: { onSelect: (jobId: bigint) => void }) {
  const { address, isConnected } = useAccount();
  const deflexy = useDeflexy();
  const { data: profileId } = useProfileId();
  const { data: meta } = useProfileMeta(profileId);
  const tx = useTx();
  const [editOpen, setEditOpen] = useState(false);
  const [delegatesOpen, setDelegatesOpen] = useState(false);
  const hasProfile = !!profileId && profileId !== 0n;

  const { data: rep } = useQuery({
    queryKey: ["reputation", profileId?.toString()],
    enabled: !!deflexy && hasProfile,
    retry: false,
    queryFn: async () => {
      try {
        const d = (await deflexy!.query.reputation(profileId!)) as {
          reputation: { completedAsFreelancer: string; completedAsEmployer: string; volumeAsFreelancer: string } | null;
        };
        return d.reputation;
      } catch {
        return null;
      }
    },
  });

  const { data: claimable } = useQuery({
    queryKey: ["claimable", address, USDC],
    enabled: !!deflexy && !!address,
    queryFn: () => deflexy!.read.claimable(address!, USDC),
    refetchInterval: 8000,
  });

  const { data: postedJobs } = useQuery({
    queryKey: ["myJobs", profileId?.toString()],
    enabled: !!deflexy && hasProfile,
    queryFn: async () => ((await deflexy!.read.listJobs(100)) as JobItem[]).filter((j) => j.employerProfileId === profileId),
    refetchInterval: 8000,
  });

  const { data: myBids } = useQuery({
    queryKey: ["myBids", profileId?.toString()],
    enabled: !!deflexy && hasProfile,
    queryFn: async () => (await deflexy!.read.listBids()).filter((b) => b.freelancerProfileId === profileId),
    refetchInterval: 8000,
  });

  // Per-role agreement list from the indexer (proper history, not derived from chain reads).
  const { data: agreements, isError: agrError } = useQuery({
    queryKey: ["myAgreements", profileId?.toString()],
    enabled: !!deflexy && hasProfile,
    retry: false,
    queryFn: async () => {
      const [emp, free] = await Promise.all([
        deflexy!.query.agreementsByEmployer(profileId!) as Promise<{ agreements: { items: Omit<Agr, "role">[] } }>,
        deflexy!.query.agreementsByFreelancer(profileId!) as Promise<{ agreements: { items: Omit<Agr, "role">[] } }>,
      ]);
      const tag = (items: Omit<Agr, "role">[], role: Agr["role"]): Agr[] => items.map((a) => ({ ...a, role }));
      return [...tag(emp.agreements.items, "Client"), ...tag(free.agreements.items, "Freelancer")].sort(
        (a, b) => Number(BigInt(b.id) - BigInt(a.id)),
      );
    },
  });

  async function createProfile() {
    if (!deflexy || !address) return;
    await tx.run(() => deflexy.write.createProfile(keccak256(toBytes(`profile:${address}`))), [["profile"]], "Profile created");
  }

  if (!isConnected) {
    return <Empty icon="solar:wallet-outline" text="Connect a wallet to view your profile." />;
  }
  if (profileId !== undefined && !hasProfile) {
    return (
      <div className="border-border/60 bg-card flex flex-col items-center gap-4 rounded-2xl border border-dashed py-14 text-center">
        <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
          <Icon icon="solar:user-plus-bold-duotone" className="size-7" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">Create your profile</p>
          <p className="text-muted-foreground max-w-xs text-xs">
            An on-chain identity lets you post jobs, submit proposals, and build reputation.
          </p>
        </div>
        <Button size="lg" loading={tx.busy} onClick={createProfile}>
          <Icon icon="solar:user-plus-bold-duotone" className="size-4" /> Create Profile
        </Button>
        {tx.error && <p className="text-destructive text-xs">{tx.error}</p>}
      </div>
    );
  }

  const completedFree = Number(rep?.completedAsFreelancer ?? 0);
  const completedEmp = Number(rep?.completedAsEmployer ?? 0);
  const earned = BigInt(rep?.volumeAsFreelancer ?? "0");

  async function withdraw() {
    if (!deflexy) return;
    await tx.run(() => deflexy.write.withdraw(USDC), [["claimable", address, USDC]], "Funds withdrawn");
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        <p className="text-muted-foreground text-xs">Your identity, balance, and activity</p>
      </div>

      {/* Identity */}
      <Card className="gap-0 py-5">
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-info))" }}
            >
              {meta?.name ? meta.name.charAt(0).toUpperCase() : `#${profileId?.toString()}`}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{meta?.name || `Profile #${profileId?.toString()}`}</div>
              <div className="text-muted-foreground font-mono text-xs">{address && short(address)}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDelegatesOpen(true)}>
                <Icon icon="solar:users-group-rounded-outline" className="size-4" /> Delegates
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Icon icon="solar:pen-2-outline" className="size-4" /> Edit
              </Button>
            </div>
          </div>
          {meta?.bio && <p className="text-muted-foreground text-sm whitespace-pre-wrap">{meta.bio}</p>}
          <div className="grid grid-cols-3 gap-2">
            <Stat icon="solar:case-minimalistic-outline" label="As freelancer" value={completedFree} />
            <Stat icon="solar:user-hand-up-outline" label="As employer" value={completedEmp} />
            <Stat icon="solar:wallet-money-outline" label="Earned" value={usdc(earned)} />
          </div>
        </CardContent>
      </Card>

      {hasProfile && (
        <>
          <EditProfileSheet open={editOpen} onOpenChange={setEditOpen} profileId={profileId!} current={meta} />
          <DelegatesSheet open={delegatesOpen} onOpenChange={setDelegatesOpen} profileId={profileId!} />
        </>
      )}

      {/* Withdrawable */}
      <Card className="gap-0 py-4">
        <CardContent className="flex items-center gap-3">
          <div className="bg-success/10 text-success flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Icon icon="solar:hand-money-outline" className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-semibold tracking-tight">{usdc(claimable ?? 0n)}</div>
            <div className="text-muted-foreground text-xs">Withdrawable · summed across all your agreements</div>
          </div>
          <Button className="ml-auto" loading={tx.busy} disabled={!claimable || claimable === 0n} onClick={withdraw}>
            Withdraw
          </Button>
        </CardContent>
      </Card>

      {/* Posted jobs */}
      <Section title={`Posted jobs (${postedJobs?.length ?? 0})`}>
        <JobList items={postedJobs} onSelect={onSelect} emptyIcon="solar:shop-outline" emptyText="You haven't posted any jobs." />
      </Section>

      {/* Bids placed */}
      <Section title={`Bids placed (${myBids?.length ?? 0})`}>
        {!myBids ? (
          <ListSkeleton />
        ) : myBids.length === 0 ? (
          <EmptyRow icon="solar:hand-shake-outline" text="You haven't bid on any jobs." />
        ) : (
          <div className="border-border/60 bg-card divide-border/50 overflow-hidden rounded-xl border shadow-xs divide-y">
            {myBids.map((b) => (
              <button
                key={b.id.toString()}
                onClick={() => onSelect(b.jobId)}
                className="hover:bg-surface/70 group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
              >
                <span className="text-muted-foreground w-12 shrink-0 font-mono text-xs">job #{b.jobId.toString()}</span>
                <Badge variant={bidVariant(b.status)}>{BID_STATUS[b.status]}</Badge>
                <span className="ml-auto font-mono text-sm font-medium">{usdc(b.amount)}</span>
                <Icon icon="solar:alt-arrow-right-outline" className="text-muted-foreground/50 group-hover:text-foreground size-4 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Agreements (indexer, per role) */}
      <Section title={`Agreements (${agreements?.length ?? 0})`}>
        {agrError ? (
          <EmptyRow icon="solar:cloud-cross-outline" text="Indexer offline — agreement history unavailable." />
        ) : !agreements ? (
          <ListSkeleton />
        ) : agreements.length === 0 ? (
          <EmptyRow icon="solar:document-outline" text="No agreements yet." />
        ) : (
          <div className="border-border/60 bg-card divide-border/50 overflow-hidden rounded-xl border shadow-xs divide-y">
            {agreements.map((a) => (
              <button
                key={`${a.role}-${a.id}`}
                onClick={() => onSelect(BigInt(a.jobId))}
                className="hover:bg-surface/70 group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
              >
                <span className="text-muted-foreground w-10 shrink-0 font-mono text-xs">#{a.id}</span>
                <Badge variant={agrVariant(a.status)}>{AGR_STATUS[a.status]}</Badge>
                <Badge variant="secondary">{a.role}</Badge>
                <span className="text-muted-foreground hidden text-xs sm:inline">{MODELS[a.model] ?? a.model}</span>
                <span className="ml-auto font-mono text-sm font-medium">{usdc(BigInt(a.totalAmount))}</span>
                <Icon icon="solar:alt-arrow-right-outline" className="text-muted-foreground/50 group-hover:text-foreground size-4 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function JobList({
  items,
  onSelect,
  emptyIcon,
  emptyText,
}: {
  items: JobItem[] | undefined;
  onSelect: (jobId: bigint) => void;
  emptyIcon: string;
  emptyText: string;
}) {
  if (!items) return <ListSkeleton />;
  if (items.length === 0) return <EmptyRow icon={emptyIcon} text={emptyText} />;
  return (
    <div className="border-border/60 bg-card divide-border/50 overflow-hidden rounded-xl border shadow-xs divide-y">
      {items
        .slice()
        .sort((a, b) => Number(b.id - a.id))
        .map((j) => (
          <button
            key={j.id.toString()}
            onClick={() => onSelect(j.id)}
            className="hover:bg-surface/70 group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
          >
            <span className="text-muted-foreground w-8 shrink-0 font-mono text-xs">#{j.id.toString()}</span>
            <Badge variant={jobStatusVariant(j.status)}>{JOB_STATUS[j.status]}</Badge>
            <span className="text-sm">{MODELS[j.model] ?? j.model}</span>
            <span className="ml-auto font-mono text-sm font-medium">{usdc(j.budget)}</span>
            <Icon icon="solar:alt-arrow-right-outline" className="text-muted-foreground/50 group-hover:text-foreground size-4 shrink-0" />
          </button>
        ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: ReactNode }) {
  return (
    <div className="bg-surface/60 rounded-lg border px-3 py-2">
      <Icon icon={icon} className="text-primary mb-1 size-4" />
      <div className="truncate text-sm font-semibold">{value}</div>
      <div className="text-muted-foreground text-[11px]">{label}</div>
    </div>
  );
}

const ListSkeleton = () => (
  <div className="space-y-2">
    {[0, 1].map((i) => (
      <div key={i} className="bg-surface/60 h-[50px] animate-pulse rounded-xl" />
    ))}
  </div>
);

const EmptyRow = ({ icon, text }: { icon: string; text: string }) => (
  <div className="border-border/60 text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-sm">
    <Icon icon={icon} className="size-5 opacity-50" />
    {text}
  </div>
);

const Empty = ({ icon, text }: { icon: string; text: string }) => (
  <div className="border-border/60 text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center text-sm">
    <Icon icon={icon} className="size-6 opacity-50" />
    {text}
  </div>
);
