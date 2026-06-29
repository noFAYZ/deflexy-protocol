import { useState } from "react";
import { formatUnits, type Hex } from "viem";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AttachmentLink } from "@/components/Attachment";
import { BidSheet, ProposalsSection } from "@/components/BidPanels";
import { AgreementSection, PaymentHistory, type AgreementData } from "@/components/AgreementSection";
import { useDeflexy } from "@/deflexy";
import { useAccessLink, useBrief, useProfileId } from "@/hooks";
import type { Brief } from "@/lib/ipfs";
import { JOB_STATUS, MODELS, jobStatusVariant } from "@/lib/format";
import { cn } from "@/lib/utils";

const isImage = (mime?: string) => !!mime && mime.startsWith("image/");

export function JobDetail({ jobId, onBack }: { jobId: bigint; onBack: () => void }) {
  const deflexy = useDeflexy();
  const { data: myProfileId } = useProfileId();
  const [applyOpen, setApplyOpen] = useState(false);

  const { data: job } = useQuery({
    queryKey: ["job", jobId.toString()],
    enabled: !!deflexy,
    queryFn: async () => ({ id: jobId, ...(await deflexy!.read.getJob(jobId)) }),
    refetchInterval: 8000,
  });
  const { data: agreement } = useQuery({
    queryKey: ["agreement", jobId.toString()],
    enabled: !!deflexy,
    queryFn: () => deflexy!.read.agreementForJob(jobId),
    refetchInterval: 8000,
  });
  const { data: bids } = useQuery({
    queryKey: ["bids", jobId.toString()],
    enabled: !!deflexy,
    queryFn: () => deflexy!.read.listBids(jobId),
    refetchInterval: 8000,
  });

  const agr = agreement as unknown as AgreementData | null;
  // Used only to gate the Work / Payments tabs — shares cache keys with AgreementSection (no extra RPC).
  const { data: units } = useQuery({
    queryKey: ["units", (agr?.id ?? 0n).toString()],
    enabled: !!deflexy && !!agr,
    queryFn: () => deflexy!.read.listWorkUnits(agr!.id),
    refetchInterval: 8000,
  });
  const { data: payments } = useQuery({
    queryKey: ["payments", (agr?.vaultId ?? 0n).toString()],
    enabled: !!deflexy && !!agr,
    retry: false,
    refetchInterval: 12000,
    queryFn: async () => {
      const d = (await deflexy!.query.paymentsForVault(agr!.vaultId)) as { payments: { items: unknown[] } };
      return d.payments.items;
    },
  });

  const { data: brief, isLoading: briefLoading } = useBrief(job?.metadataCID);

  const hasProfile = !!myProfileId && myProfileId !== 0n;
  const isEmployer = !!job && myProfileId === job.employerProfileId;
  const myBid = bids?.find((b) => myProfileId !== undefined && b.freelancerProfileId === myProfileId && b.status === 1);
  const canApply = !!job && !agreement && job.status === 1 && hasProfile && !isEmployer && !myBid;

  // Role/state-relevant tabs — each appears only once its stage is reached.
  const showProposals = (bids?.length ?? 0) > 0 || job?.status === 1;
  const hasUnits = (units?.length ?? 0) > 0;
  const hasPayments = (payments?.length ?? 0) > 0;
  const tabs = [
    ...(showProposals ? [{ key: "proposals", label: `Proposals${bids?.length ? ` (${bids.length})` : ""}` }] : []),
    ...(agreement ? [{ key: "agreement", label: "Agreement" }] : []),
    ...(agreement && hasUnits ? [{ key: "work", label: `Work (${units!.length})` }] : []),
    ...(agreement && hasPayments ? [{ key: "payments", label: "Payments" }] : []),
  ];
  // Default to the next actionable step for the role/state; a manual click overrides it.
  const agrStatus = agr?.status;
  const nextTab = agreement ? (agrStatus === 1 && hasUnits ? "work" : "agreement") : "proposals";
  const [view, setView] = useState<string | null>(null);
  const active =
    view && tabs.some((t) => t.key === view)
      ? view
      : tabs.some((t) => t.key === nextTab)
        ? nextTab
        : tabs[0]?.key;

  return (
    <div className="space-y-5">
{/*       <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2" onClick={onBack}>
          <Icon icon="solar:arrow-left-linear" /> Back to jobs
        </Button>
        {canApply && (
          <Button size="sm" onClick={() => setApplyOpen(true)}>
            <Icon icon="solar:pen-new-square-outline" /> Apply
          </Button>
        )}
      </div>
      {canApply && job && (
        <BidSheet open={applyOpen} onOpenChange={setApplyOpen} jobId={job.id} profileId={myProfileId!} budget={job.budget} />
      )}
 */}
      {!job ? (
        <p className="text-muted-foreground text-sm">Loading job…</p>
      ) : (
        <>
        <div className="flex flex-col gap-4 p-4  bg-accent rounded border">
          {/* Title + budget */}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{brief?.title ?? `Job #${job.id.toString()}`}</h2>
            <span className="text-muted-foreground ml-auto font-mono text-lg font-semibold">
              {formatUnits(job.budget, 6)} <span className="text-xs">USDC</span>
            </span>
          </div>

          {/* Badges below title */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={jobStatusVariant(job.status)}>{JOB_STATUS[job.status]}</Badge>
            {brief?.category && (
              <Badge variant="subtle" className="gap-1">
                <Icon icon="solar:folder-outline" className="size-3" /> {brief.category}
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1">
              <Icon icon="solar:checklist-minimalistic-outline" className="size-3" /> {MODELS[job.model] ?? String(job.model)}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Icon icon="solar:users-group-rounded-outline" className="size-3" /> {bids?.length ?? 0} proposals
            </Badge>
            {job.createdAt > 0n && (
              <Badge variant="subtle" className="gap-1">
                <Icon icon="solar:calendar-outline" className="size-3" /> {new Date(Number(job.createdAt) * 1000).toLocaleDateString()}
              </Badge>
            )}
          </div>
          {!!brief?.tags?.length && (
            <div className="flex flex-wrap items-center gap-1.5">
              {brief.tags.map((t) => (
                <Badge key={t} variant="outline">
                  #{t}
                </Badge>
              ))}
            </div>
          )}</div>

          {/* Brief (clamped, expandable) */}
          <BriefBody brief={brief} loading={briefLoading} />

          {/* Tabs below details */}
          {tabs.length > 0 && active && (
            <Tabs value={active} onValueChange={setView} className="gap-4" >
              <TabsList variant="ghost" className="w-full justify-start" >
                {tabs.map((t) => (
                  <TabsTrigger key={t.key} value={t.key} className="flex-none">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {showProposals && (
                <TabsContent value="proposals" className="space-y-3">
                  {job.status === 1 && !hasProfile && !isEmployer && (
                    <p className="text-muted-foreground text-sm">Create a profile (right sidebar) to apply to this job.</p>
                  )}
                  <ProposalsSection
                    jobId={job.id}
                    myProfileId={myProfileId ?? 0n}
                    isEmployer={isEmployer}
                    jobOpen={job.status === 1}
                  />
                  {job.status !== 1 && (
                    <p className="text-muted-foreground text-xs">
                      This job is {JOB_STATUS[job.status]?.toLowerCase()} and not accepting new proposals.
                    </p>
                  )}
                </TabsContent>
              )}

              {agreement && (
                <>
                  <TabsContent value="agreement">
                    <AgreementSection agreement={agreement as unknown as AgreementData} myProfileId={myProfileId ?? 0n} section="overview" />
                  </TabsContent>
                  <TabsContent value="work">
                    <AgreementSection agreement={agreement as unknown as AgreementData} myProfileId={myProfileId ?? 0n} section="work" />
                  </TabsContent>
                  <TabsContent value="payments">
                    <PaymentHistory vaultId={(agreement as unknown as AgreementData).vaultId} />
                  </TabsContent>
                </>
              )}
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}

/** Decrypted description + attachments (image thumbnails + file links). */
function BriefBody({ brief, loading }: { brief?: Brief | null; loading: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (loading) return <div className="bg-surface/60 h-20 animate-pulse rounded-lg" />;
  if (!brief) return null;
  const images = brief.attachments?.filter((a) => isImage(a.mime)) ?? [];
  const files = brief.attachments?.filter((a) => !isImage(a.mime)) ?? [];
  const desc = brief.description;
  // The excerpt is two lines of text only; attachments stay hidden until expanded.
  const long = !!desc && (desc.length > 140 || desc.split("\n").length > 2);
  const hasAttachments = images.length > 0 || files.length > 0;
  const hasMore = long || hasAttachments;

  return (
    <div className="space-y-4">
      {desc && (
        <div className="bg-card rounded-lg p-3.5">
          <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", !expanded && "line-clamp-2")}>{desc}</p>
          {hasMore && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-primary mt-1.5 text-xs font-medium hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {expanded && images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <ImageThumb key={a.ref} cid={a.ref} name={a.name} />
          ))}
        </div>
      )}

      {expanded && files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((a) => (
            <div key={a.ref} className="flex items-center gap-2 text-sm">
              <Icon icon="solar:file-text-outline" className="text-muted-foreground size-4 shrink-0" />
              <AttachmentLink cid={a.ref} label={a.name || "Attachment"} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small optimized thumbnail; click opens the full-resolution image in a lightbox. */
function ImageThumb({ cid, name }: { cid: Hex; name: string }) {
  const [open, setOpen] = useState(false);
  const [optFailed, setOptFailed] = useState(false);
  const [plainFailed, setPlainFailed] = useState(false);

  // Try the optimized thumbnail; if the gateway doesn't support transforms (link errors or
  // the image fails to load), fall back to the plain access link so the image still shows.
  const optimized = useAccessLink(cid, { width: 320 });
  const wantPlain = optFailed || optimized.isError;
  const plain = useAccessLink(wantPlain ? cid : null);
  const full = useAccessLink(open ? cid : null); // full-res link minted only once opened

  const thumbSrc = wantPlain ? plain.data : optimized.data;
  const failed = plainFailed || (wantPlain && plain.isError);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        title={name}
        className="bg-surface/60 hover:ring-primary/50 text-muted-foreground relative grid size-24 place-items-center overflow-hidden rounded-lg border transition hover:ring-2"
      >
        {failed ? (
          <Icon icon="solar:gallery-broken" className="size-5" />
        ) : thumbSrc ? (
          <img
            src={thumbSrc}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => (wantPlain ? setPlainFailed(true) : setOptFailed(true))}
            className="size-full object-cover"
          />
        ) : (
          <Icon icon="svg-spinners:90-ring-with-bg" className="size-5" />
        )}
      </button>
      <DialogContent className="max-w-3xl p-2">
        {full.data ? (
          <img src={full.data} alt={name} className="max-h-[80vh] w-full rounded object-contain" />
        ) : full.isError ? (
          <p className="text-muted-foreground p-6 text-center text-sm">Couldn't load image.</p>
        ) : (
          <div className="grid h-64 place-items-center">
            <Icon icon="svg-spinners:90-ring-with-bg" className="text-muted-foreground size-6" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
