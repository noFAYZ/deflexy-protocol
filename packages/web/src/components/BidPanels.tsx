import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, parseUnits } from "viem";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AttachmentLink } from "@/components/Attachment";
import { ProfileName } from "@/components/ProfileName";
import { useDeflexy, USDC } from "@/deflexy";
import { useAttachment, useTx, withUploadToast } from "@/hooks";
import { uploadAttachment } from "@/lib/ipfs";
import { cn } from "@/lib/utils";

const BID_STATUS = ["None", "Submitted", "Accepted", "Withdrawn", "Rejected"];
const DAY = 86_400n;
const DURATION_PRESETS = [3, 7, 14, 30];

const trimZeros = (s: string) => s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");

/** Right-side application sheet: freelancer submits a bid with modern amount/duration inputs. */
export function BidSheet({
  open,
  onOpenChange,
  jobId,
  profileId,
  budget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: bigint;
  profileId: bigint;
  budget: bigint;
}) {
  const deflexy = useDeflexy();
  const tx = useTx();
  const budgetUsd = formatUnits(budget, 6);
  const [amount, setAmount] = useState(budgetUsd);
  const [days, setDays] = useState("7");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const amountNum = Number(amount);
  const daysNum = Number(days);
  const validAmount = Number.isFinite(amountNum) && amountNum > 0;
  const validDays = Number.isInteger(daysNum) && daysNum > 0;
  const valid = validAmount && validDays;

  const deliverBy = useMemo(() => {
    if (!validDays) return null;
    return new Date(Date.now() + daysNum * 86_400_000).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [daysNum, validDays]);

  // Protocol fee preview: quote returns [fee, net, treasury].
  const { data: quote } = useQuery({
    queryKey: ["feeQuote", amount],
    enabled: !!deflexy && validAmount,
    staleTime: 60_000,
    queryFn: () => deflexy!.read.feeQuote(USDC, parseUnits(amount, 6)),
  });
  const net = quote ? (quote[1] as bigint) : null;
  const fee = quote ? (quote[0] as bigint) : null;

  async function submit() {
    if (!deflexy || !valid) return;
    const ok = await tx.run(
      async () => {
        const cid = await withUploadToast(uploadAttachment(text, file), file ? "Uploading attachment…" : "Saving proposal…");
        return deflexy.write.submitBid(jobId, profileId, parseUnits(amount, 6), BigInt(daysNum) * DAY, cid);
      },
      [["bids", jobId.toString()]],
      "Application submitted",
    );
    if (ok) {
      onOpenChange(false);
      setText("");
      setFile(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Apply to this job</SheetTitle>
          <SheetDescription>Submit your proposal — funds settle in USDC when the employer accepts.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Amount — enlarged, borderless */}
          <div className="bg-surface/40 rounded-2xl p-5">
            <div className="text-muted-foreground text-center text-xs font-medium tracking-wide uppercase">Your bid</div>
            <div className="mt-2 flex items-baseline justify-center gap-1.5">
              <input
                id="bid-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                style={{ width: `${Math.max(amount.length, 1)}ch` }}
                className="caret-primary min-w-[1ch] bg-transparent text-center text-4xl font-bold tracking-tight outline-none"
              />
              <span className="text-muted-foreground text-xl font-semibold">USDC</span>
            </div>
            <p className="text-muted-foreground mt-1 text-center text-xs">
              {validAmount && net !== null && fee !== null
                ? `You receive ~${formatUnits(net, 6)} USDC after ${formatUnits(fee, 6)} fee`
                : validAmount
                  ? `Budget ${budgetUsd} USDC`
                  : "Enter an amount"}
            </p>
            <div className="mt-3 flex justify-center gap-1.5">
              {[0.75, 0.9, 1].map((f) => {
                const v = trimZeros((Number(budgetUsd) * f).toFixed(2));
                return (
                  <Chip key={f} active={amount === v} onClick={() => setAmount(v)}>
                    {f === 1 ? "Match" : `${Math.round(f * 100)}%`}
                  </Chip>
                );
              })}
            </div>
          </div>

          {/* Duration — enlarged, borderless */}
          <div className="bg-surface/40 rounded-2xl p-5">
            <div className="text-muted-foreground text-center text-xs font-medium tracking-wide uppercase">Duration</div>
            <div className="mt-2 flex items-baseline justify-center gap-1.5">
              <input
                value={days}
                onChange={(e) => setDays(e.target.value)}
                inputMode="numeric"
                placeholder="0"
                style={{ width: `${Math.max(days.length, 1)}ch` }}
                className="caret-primary min-w-[1ch] bg-transparent text-center text-4xl font-bold tracking-tight outline-none"
              />
              <span className="text-muted-foreground text-xl font-semibold">days</span>
            </div>
            <p className="text-muted-foreground mt-1 text-center text-xs">
              {deliverBy ? `Delivery by ${deliverBy}` : "Estimated duration"}
            </p>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {DURATION_PRESETS.map((d) => (
                <Chip
                  key={d}
                  active={days === String(d)}
                  onClick={() => setDays(String(d))}
                  className="justify-center text-center"
                >
                  {d}d
                </Chip>
              ))}
            </div>
          </div>

          {/* Proposal */}
          <div className="space-y-2">
            <Label htmlFor="bid-proposal">Proposal</Label>
            <Textarea
              id="bid-proposal"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Pitch your approach, scope, and timeline…"
              className="resize-none"
            />
            <label className="border-input text-muted-foreground hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition">
              <Icon icon="solar:paperclip-outline" className="size-4 shrink-0" />
              <span className="truncate">{file?.name ?? "Attach a file (optional)"}</span>
              {file && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setFile(null);
                  }}
                  className="hover:text-foreground ml-auto shrink-0"
                >
                  <Icon icon="solar:close-circle-bold" className="size-4" />
                </button>
              )}
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {tx.error && <p className="text-destructive text-sm">{tx.error}</p>}
        </div>

        <div className="mt-6">
          <Button onClick={submit} loading={tx.busy} disabled={!valid} className="w-full">
            {tx.busy ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Chip({
  active,
  onClick,
  className,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-surface hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

interface Bid {
  id: bigint;
  freelancerProfileId: bigint;
  amount: bigint;
  status: number;
  proposalCID: `0x${string}`;
}

/** All proposals on a job. Everyone sees the list; only the client (or the proposal's own
 * author) sees its content — others' text stays private. */
export function ProposalsSection({
  jobId,
  myProfileId,
  isEmployer,
  jobOpen,
}: {
  jobId: bigint;
  myProfileId: bigint;
  isEmployer: boolean;
  jobOpen: boolean;
}) {
  const deflexy = useDeflexy();
  const tx = useTx();
  const qc = useQueryClient();
  const bidsKey = ["bids", jobId.toString()];
  const { data: bids } = useQuery({
    queryKey: bidsKey,
    enabled: !!deflexy,
    queryFn: () => deflexy!.read.listBids(jobId),
    refetchInterval: 8000,
  });

  async function accept(bidId: bigint) {
    if (!deflexy) return;
    await tx.run(
      () => deflexy.write.createAgreement(jobId, bidId),
      [["agreement", jobId.toString()], ["job", jobId.toString()], ["jobs"], bidsKey],
      "Proposal accepted",
    );
  }
  async function withdraw(bidId: bigint) {
    if (!deflexy) return;
    // Optimistic: mark withdrawn right away; restore on failure.
    const prev = qc.getQueryData(bidsKey);
    qc.setQueryData(bidsKey, (old: unknown) =>
      Array.isArray(old) ? old.map((b: { id: bigint }) => (b.id === bidId ? { ...b, status: 3 } : b)) : old,
    );
    const ok = await tx.run(() => deflexy.write.withdrawBid(bidId), [bidsKey], "Proposal withdrawn");
    if (!ok) qc.setQueryData(bidsKey, prev);
  }

  // Show the viewer's own proposal first.
  const list = [...(bids ?? [])].sort(
    (a, b) => Number(b.freelancerProfileId === myProfileId) - Number(a.freelancerProfileId === myProfileId),
  );

  return (
    <div className="space-y-3">
  
      {list.length === 0 && <p className="text-muted-foreground text-sm">No proposals yet.</p>}
      {tx.error && <p className="text-destructive text-sm">{tx.error}</p>}
      <div className="space-y-2.5">
        {list.map((b) => (
          <ProposalRow
            key={b.id.toString()}
            bid={b}
            mine={b.freelancerProfileId === myProfileId}
            canSee={isEmployer || b.freelancerProfileId === myProfileId}
            canAccept={isEmployer && jobOpen && b.status === 1}
            busy={tx.busy}
            onAccept={() => accept(b.id)}
            onWithdraw={() => withdraw(b.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ProposalRow({
  bid,
  mine,
  canSee,
  canAccept,
  busy,
  onAccept,
  onWithdraw,
}: {
  bid: Bid;
  mine: boolean;
  canSee: boolean;
  canAccept: boolean;
  busy: boolean;
  onAccept: () => void;
  onWithdraw: () => void;
}) {
  // Only fetched when the viewer is allowed to see it (null ref ⇒ no request).
  const { data: proposal, isLoading } = useAttachment(canSee ? bid.proposalCID : null);

  return (
    <div className={cn("space-y-2 rounded-lg border p-3 text-sm", mine ? "border-primary/40 bg-primary/5" : "bg-muted/40")}>
      <div className="flex items-center gap-2">
        <Badge variant={mine ? "default" : "secondary"}>
          {mine ? "You" : <ProfileName profileId={bid.freelancerProfileId} prefix="Freelancer" />}
        </Badge>
        <Badge variant={bid.status === 1 ? "success" : bid.status === 2 ? "default" : "outline"}>
          {BID_STATUS[bid.status]}
        </Badge>
        <span className="ml-auto font-mono font-medium">{formatUnits(bid.amount, 6)} USDC</span>
      </div>

      {canSee ? (
        <>
          {isLoading ? (
            <div className="bg-surface/60 h-8 animate-pulse rounded" />
          ) : proposal?.text ? (
            <p className="text-muted-foreground line-clamp-3 whitespace-pre-wrap">{proposal.text}</p>
          ) : (
            <p className="text-muted-foreground italic">No description provided.</p>
          )}
          {proposal?.file && <AttachmentLink cid={proposal.file} label={proposal.name || "Attachment"} />}
        </>
      ) : (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Icon icon="solar:lock-keyhole-minimalistic-outline" className="size-3.5" />
          Proposal is private to the client.
        </p>
      )}

      {(canAccept || (mine && bid.status === 1)) && (
        <div className="flex justify-end gap-2 pt-1">
          {mine && bid.status === 1 && (
            <Button size="sm" variant="outline" loading={busy} onClick={onWithdraw}>
              Withdraw
            </Button>
          )}
          {canAccept && (
            <Button size="sm" loading={busy} onClick={onAccept}>
              Accept
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
