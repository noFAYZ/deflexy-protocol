import { useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BidSheet, ProposalsSection } from "@/components/BidPanels";
import {
  FundForm,
  AddWorkUnitForm,
  CloseButtons,
  WithdrawButton,
  WorkUnitRow,
  type AgreementData,
  type Unit,
} from "@/components/AgreementSection";
import { useDeflexy } from "@/deflexy";
import { useProfileId } from "@/hooks";
import { cn } from "@/lib/utils";

interface Step {
  key: string;
  label: string;
  icon: string;
  done: boolean;
  actionable: boolean;
  title?: string;
  desc?: string;
  count?: number;
  render?: () => ReactNode;
  custom?: () => void;
}

// Short CTA label for the header button, by step key.
const CTA: Record<string, string> = {
  accept: "Accept",
  fund: "Fund",
  work: "Add units",
  review: "Review",
  close: "Settle",
  apply: "Apply",
  start: "Start work",
  submit: "Submit",
  paid: "Withdraw",
};

export function JobStepper({ jobId }: { jobId: bigint }) {
  const deflexy = useDeflexy();
  const { address } = useAccount();
  const { data: myProfileId } = useProfileId();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const { data: job } = useQuery({
    queryKey: ["job", jobId.toString()],
    enabled: !!deflexy,
    queryFn: async () => ({
      id: jobId,
      ...(await deflexy!.read.getJob(jobId)),
    }),
  });

  const { data: agreement } = useQuery({
    queryKey: ["agreement", jobId.toString()],
    enabled: !!deflexy,
    queryFn: () =>
      deflexy!.read.agreementForJob(jobId) as Promise<AgreementData | null>,
  });

  const { data: bids } = useQuery({
    queryKey: ["bids", jobId.toString()],
    enabled: !!deflexy,
    queryFn: () => deflexy!.read.listBids(jobId),
  });

  const agr = agreement ?? null;
  const aid = agr?.id ?? 0n;

  const { data: units } = useQuery({
    queryKey: ["units", aid.toString()],
    enabled: !!deflexy && !!agr,
    queryFn: () =>
      deflexy!.read.listWorkUnits(aid) as Promise<Unit[]>,
  });

  const { data: available } = useQuery({
    queryKey: ["vault", aid.toString()],
    enabled: !!deflexy && !!agr,
    queryFn: () => deflexy!.read.vaultAvailable(agr!.vaultId),
  });

  const { data: vault } = useQuery({
    queryKey: ["vaultFull", aid.toString()],
    enabled: !!deflexy && !!agr,
    queryFn: () =>
      deflexy!.read.getVault(agr!.vaultId) as Promise<{
        deposited: bigint;
      }>,
  });

  const { data: claimable } = useQuery({
    queryKey: ["claimable", address, agr?.paymentToken],
    enabled: !!deflexy && !!address && !!agr,
    queryFn: () =>
      deflexy!.read.claimable(address!, agr!.paymentToken),
  });

  if (!job || myProfileId === undefined) return null;

  const hasProfile = myProfileId !== 0n;
  const isEmployer = myProfileId === job.employerProfileId;
  const isFreelancer = !!agr && myProfileId === agr.freelancerProfileId;
  const jobOpen = job.status === 1;
  const active = agr?.status === 1;
  const avail = available ?? 0n;
  const remaining = agr ? agr.totalAmount - agr.allocated : 0n;
  const myBid = bids?.find(
    (b) =>
      b.freelancerProfileId === myProfileId &&
      (b.status === 1 || b.status === 2)
  );

  const invKeys = [
    ["units", aid.toString()],
    ["agreement", jobId.toString()],
    ["vault", aid.toString()],
  ];
  const u = units ?? [];
  const startable = u.filter((x) => x.status === 1);
  const submittable = u.filter((x) => x.status === 2 || x.status === 4);
  const inReview = u.filter((x) => x.status === 3);
  const settleable = u.filter((x) => x.status === 5);
  const hasUnits = u.length > 0;

  const workUnits = () => (
    <div className="space-y-2">
      {u.map((unit) => (
        <WorkUnitRow
          key={unit.id.toString()}
          unit={unit}
          isEmployer={isEmployer}
          isFreelancer={isFreelancer}
          active={!!active}
          available={avail}
          invKeys={invKeys}
        />
      ))}
      {!hasUnits && (
        <p className="text-muted-foreground py-4 text-center text-sm">
          No work units yet.
        </p>
      )}
    </div>
  );

  const canApply =
    jobOpen && hasProfile && !isEmployer && !agr && !myBid;

  if (!isEmployer && !isFreelancer && !canApply && !myBid) return null;

  let steps: Step[];
  if (isEmployer) {
    steps = [
      {
        key: "post",
        label: "Job posted",
        icon: "solar:posts-carousel-vertical-bold-duotone",
        done: true,
        actionable: false,
      },
      {
        key: "accept",
        label: agr ? "Proposal accepted" : "Accept a proposal",
        icon: "solar:hand-shake-bold-duotone",
        done: !!agr,
        actionable: !agr && jobOpen,
        title: "Proposals",
        desc: "Review applications and accept one to start an agreement.",
        render: () => (
          <ProposalsSection
            jobId={jobId}
            myProfileId={myProfileId}
            isEmployer
            jobOpen={jobOpen}
          />
        ),
      },
      {
        key: "fund",
        label: "Fund escrow",
        icon: "solar:dollar-bold-duotone",
        done: !!vault && vault.deposited > 0n,
        actionable: !!active,
        title: "Fund escrow",
        desc: "Deposit USDC into the agreement vault so work can begin.",
        render: () => <FundForm agreementId={aid} invKeys={invKeys} />,
      },
      {
        key: "work",
        label: "Add work units",
        icon: "solar:check-read-line-duotone",
        done: hasUnits,
        actionable: !!active && remaining > 0n,
        count: u.length || undefined,
        title: "Work units",
        desc: "Break the job into milestones for the freelancer to deliver.",
        render: () => (
          <div className="space-y-4">
            {remaining > 0n && (
              <AddWorkUnitForm
                agreementId={aid}
                units={u}
                max={remaining}
                invKeys={invKeys}
              />
            )}
            {workUnits()}
          </div>
        ),
      },
      {
        key: "review",
        label: "Review & approve",
        icon: "solar:check-read-bold-duotone",
        done: hasUnits && u.every((x) => x.status >= 5),
        actionable: inReview.length > 0,
        count: inReview.length || undefined,
        title: "Review deliverables",
        desc: "Approve submitted work or request a revision.",
        render: workUnits,
      },
      {
        key: "close",
        label: agr?.status === 4 ? "Completed" : "Settle & complete",
        icon: "solar:flag-2-bold-duotone",
        done: agr?.status === 4,
        actionable: !!active && hasUnits,
        title: "Settle & close",
        desc: "Settle approved units and complete the agreement.",
        render: () => (
          <div className="space-y-4">
            {workUnits()}
            <CloseButtons
              agreementId={aid}
              jobId={jobId}
              invKeys={invKeys}
            />
          </div>
        ),
      },
    ];
  } else {
    steps = [
      {
        key: "apply",
        label: myBid ? "Application submitted" : "Apply to this job",
        icon: "solar:pen-new-square-bold-duotone",
        done: !!myBid || !!agr,
        actionable: canApply,
        custom: () => setApplyOpen(true),
      },
      {
        key: "hired",
        label: agr ? "Hired" : "Get hired",
        icon: "solar:medal-ribbon-bold-duotone",
        done: !!agr,
        actionable: false,
      },
      {
        key: "start",
        label: "Start work",
        icon: "solar:play-bold-duotone",
        done: !!agr && hasUnits && startable.length === 0,
        actionable: isFreelancer && !!active && startable.length > 0,
        count: startable.length || undefined,
        title: "Start work",
        desc: "Begin a funded milestone.",
        render: workUnits,
      },
      {
        key: "submit",
        label: "Submit work",
        icon: "solar:upload-bold-duotone",
        done:
          !!agr &&
          hasUnits &&
          submittable.length === 0 &&
          startable.length === 0,
        actionable: isFreelancer && !!active && submittable.length > 0,
        count: submittable.length || undefined,
        title: "Submit deliverable",
        desc: "Upload your work for the client to review.",
        render: workUnits,
      },
      {
        key: "paid",
        label: "Get paid",
        icon: "solar:wallet-money-bold-duotone",
        done: agr?.status === 4,
        actionable:
          isFreelancer &&
          (settleable.length > 0 || (claimable ?? 0n) > 0n),
        title: "Get paid",
        desc: "Settle approved work and withdraw your balance.",
        render: () => (
          <div className="space-y-4">
            {workUnits()}
            {(claimable ?? 0n) > 0n && agr && (
              <WithdrawButton
                token={agr.paymentToken}
                amount={claimable!}
                invKeys={[
                  ["claimable", address, agr.paymentToken],
                ]}
              />
            )}
          </div>
        ),
      },
    ];
  }

  const completedCount = steps.filter((s) => s.done).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const current = steps.find((s) => s.key === openKey);
  const nextStep = steps.find((s) => s.actionable && (s.render || s.custom));

  return (
    <>
      <div className="bg-card overflow-hidden rounded-2xl border shadow-xs">
        {/* ─── Header ─────────────────────────────────── */}
        <div className="border-b px-2 py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg ">
              <Icon
                icon="solar:routing-2-bold-duotone"
                className="size-6"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold tracking-tight">
                Next steps
              </h3>
 
            </div>
            {nextStep ? (
              <Button
                size="sm"
                onClick={() => (nextStep.custom ? nextStep.custom() : setOpenKey(nextStep.key))}
              >
                <Icon icon={nextStep.icon} className="size-4" />
                {CTA[nextStep.key] ?? nextStep.label}
              </Button>
            ) : (
              <Badge variant={progress === 100 ? "success" : "lime"} size="xs">
                {progress}%
              </Badge>
            )}
          </div>

     
        </div>

        {/* ─── Claimable Banner ───────────────────────── */}
        {(claimable ?? 0n) > 0n && agr && (
          
            <WithdrawButton
              token={agr.paymentToken}
              amount={claimable!}
              invKeys={[
                ["claimable", address, agr.paymentToken],
              ]}
            />
       
        )}

        {/* ─── Steps ──────────────────────────────────── */}
        <div className="px-3 py-2.5">
          <ol className="relative space-y-1">
            {/* Background Track Line */}
            <div
              aria-hidden
              className="absolute top-3 bottom-3 left-[24px] w-px bg-border"
            />
            
            {/* Animated Progress Fill */}
            {completedCount > 0 && (
              <div
                aria-hidden
                className="absolute top-3 left-[24px] w-px bg-lime-500 transition-all duration-400 ease-out"
                style={{
                  height: `calc(${(completedCount / steps.length) * 100}% - ${completedCount === steps.length ? 12 : 6}px)`,
                }}
              />
            )}

            {steps.map((s) => {
              const clickable = s.actionable && (s.render || s.custom);

              return (
                <li key={s.key}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() =>
                      s.custom ? s.custom() : setOpenKey(s.key)
                    }
                    className={cn(
                      "group relative flex w-full items-center gap-3.5 rounded-xl px-2.5 py-2 text-left transition-all duration-150",
                      clickable &&
                        "hover:bg-accent/60 active:scale-[0.995]",
                      !clickable && "cursor-default"
                    )}
                  >
                    {/* ─── Enhanced Node ──────────────── */}
                    <span
                      className={cn(
                        "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                        
                        // Done State: Solid with depth shadow
                        s.done && [
                          "bg-lime-600 text-white",
                          "shadow-[0_2px_8px_rgba(83,137,10,0.3)]",
                        ],
                        
                        // Actionable State: Glowing ring
                        !s.done && s.actionable && [
                          "border-1 border-muted-foreground bg-background text-muted-foreground",
                          "shadow-sm",
                          "group-hover:shadow",
                          "group-hover:border-lime-500",
                        ],
                        
                        // Locked State: Subtle depth
                        !s.done && !s.actionable && [
                          "border border-border bg-muted text-muted-foreground/30",
                        ]
                      )}
                    >
                      {s.done ? (
                        <Icon
                          icon="solar:check-read-line-duotone"
                          className="size-4"
                        />
                      ) : (
                        <Icon
                          icon={s.icon}
                          className={cn(
                            "size-4 transition-transform duration-100",
                            s.actionable && "group-hover:scale-105"
                          )}
                        />
                      )}
                    </span>

                    {/* ─── Label & Count ─────────────── */}
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-[13px] leading-snug transition-colors",
                          s.done && "text-foreground/80",
                          !s.done && s.actionable && "font-medium text-foreground",
                          !s.done && !s.actionable && "text-muted-foreground/50"
                        )}
                      >
                        {s.label}
                      </span>
                    </div>

                    <span className="flex shrink-0 items-center gap-1.5">
                      {s.count !== undefined && s.count > 0 && (
                        <span
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums transition-colors",
                            s.done
                              ? "bg-muted text-muted-foreground/70"
                              : "bg-lime-500/15 text-lime-700 dark:text-lime-400"
                          )}
                        >
                          {s.count}
                        </span>
                      )}

                      {clickable && (
                        <Icon
                          icon="solar:arrow-right-linear"
                          className={cn(
                            "size-3.5 text-transparent transition-all duration-200",
                            "group-hover:translate-x-0.5 group-hover:text-lime-600"
                          )}
                        />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

  
      </div>

      {/* ─── Sheet ────────────────────────────────────── */}
      <Sheet open={!!current} onOpenChange={(o) => !o && setOpenKey(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          {current && (
            <>
              <div className="border-b">
                <div className="h-1 w-full bg-gradient-to-r from-lime-500 via-lime-400 to-emerald-500" />
                <div className="px-6 py-5">
                  <SheetHeader className="text-left">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-lime-500/10">
                        <Icon
                          icon={current.icon}
                          className="size-4 text-lime-600"
                        />
                      </div>
                      <SheetTitle className="text-base">
                        {current.title ?? current.label}
                      </SheetTitle>
                    </div>
                    {current.desc && (
                      <SheetDescription className="mt-1.5 pl-[42px]">
                        {current.desc}
                      </SheetDescription>
                    )}
                  </SheetHeader>
                </div>
              </div>

              <div className="px-6 py-5">{current.render?.()}</div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {canApply && (
        <BidSheet
          open={applyOpen}
          onOpenChange={setApplyOpen}
          jobId={jobId}
          profileId={myProfileId}
          budget={job.budget}
        />
      )}
    </>
  );
}