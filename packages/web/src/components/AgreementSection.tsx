import { useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { erc20Abi, formatUnits, maxUint256, parseUnits, type Abi, type Address, type Hex } from "viem";
import { abis } from "@deflexy/sdk";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AttachmentField, AttachmentLink } from "@/components/Attachment";
import { useDeflexy, USDC } from "@/deflexy";
import { useTx, useBatchTx, type Call } from "@/hooks";
import { uploadAttachment } from "@/lib/ipfs";
import { short } from "@/lib/format";

const AGR_STATUS = ["None", "Active", "Disputed", "Resolved", "Completed", "Terminated"];
const WU_STATUS = ["None", "Created", "In progress", "Submitted", "Revision requested", "Approved", "Settled"];
const APPROVAL_WINDOW = 1_209_600n; // 14 days

export interface AgreementData {
  id: bigint;
  jobId: bigint;
  employerProfileId: bigint;
  freelancerProfileId: bigint;
  paymentToken: Address;
  totalAmount: bigint;
  allocated: bigint;
  vaultId: bigint;
  status: number;
  outstandingUnits: number;
}

const usdc = (v: bigint) => `${formatUnits(v, 6)} USDC`;

/** Wraps a form body in a right-side sheet — keeps the tabs button-only. */
function FormSheet({
  open,
  onOpenChange,
  title,
  desc,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {desc && <SheetDescription>{desc}</SheetDescription>}
        </SheetHeader>
        <div className="mt-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/** "Fund escrow" button → FundForm in a sheet. */
function FundButton({ agreementId, invKeys }: { agreementId: bigint; invKeys: unknown[][] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <Icon icon="solar:wallet-money-outline" className="size-4" /> Fund escrow
      </Button>
      <FormSheet open={open} onOpenChange={setOpen} title="Fund escrow" desc="Deposit USDC into the agreement vault so work can begin.">
        <FundForm agreementId={agreementId} invKeys={invKeys} onDone={() => setOpen(false)} />
      </FormSheet>
    </>
  );
}

/** "Add work unit" button → AddWorkUnitForm in a sheet. */
function AddWorkUnitButton({ agreementId, units, max, invKeys }: { agreementId: bigint; units: { sequence: bigint }[]; max: bigint; invKeys: unknown[][] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <Icon icon="solar:add-circle-outline" className="size-4" /> Add work unit
      </Button>
      <FormSheet open={open} onOpenChange={setOpen} title="Add work unit" desc="Break the job into a milestone for the freelancer to deliver.">
        <AddWorkUnitForm agreementId={agreementId} units={units} max={max} invKeys={invKeys} onDone={() => setOpen(false)} />
      </FormSheet>
    </>
  );
}

export function AgreementSection({
  agreement,
  myProfileId,
  section = "all",
}: {
  agreement: AgreementData;
  myProfileId: bigint;
  /** Which slice to render — lets JobDetail split it across "Agreement" and "Work" tabs. */
  section?: "overview" | "work" | "all";
}) {
  const deflexy = useDeflexy();
  const { address } = useAccount();
  const isEmployer = myProfileId === agreement.employerProfileId;
  const isFreelancer = myProfileId === agreement.freelancerProfileId;
  const isParticipant = isEmployer || isFreelancer;
  const active = agreement.status === 1;
  const aid = agreement.id;

  const invKeys = [["units", aid.toString()], ["agreement", agreement.jobId.toString()], ["vault", aid.toString()]];

  const { data: available } = useQuery({
    queryKey: ["vault", aid.toString()],
    enabled: !!deflexy,
    queryFn: () => deflexy!.read.vaultAvailable(agreement.vaultId),
    refetchInterval: 8000,
  });
  const { data: units } = useQuery({
    queryKey: ["units", aid.toString()],
    enabled: !!deflexy,
    queryFn: () => deflexy!.read.listWorkUnits(aid),
    refetchInterval: 8000,
  });
  const { data: claimable } = useQuery({
    queryKey: ["claimable", address, agreement.paymentToken],
    enabled: !!deflexy && !!address,
    queryFn: () => deflexy!.read.claimable(address!, agreement.paymentToken),
    refetchInterval: 8000,
  });
  const { data: dispute } = useQuery({
    queryKey: ["dispute", aid.toString()],
    enabled: !!deflexy,
    queryFn: () => deflexy!.read.disputeForAgreement(aid),
    refetchInterval: 8000,
  });
  const { data: vault } = useQuery({
    queryKey: ["vaultFull", aid.toString()],
    enabled: !!deflexy,
    queryFn: () => deflexy!.read.getVault(agreement.vaultId) as Promise<{ deposited: bigint; released: bigint; refunded: bigint }>,
    refetchInterval: 8000,
  });

  const remaining = agreement.totalAmount - agreement.allocated;
  const avail = available ?? 0n;
  const showOverview = section !== "work";
  const showWork = section !== "overview";

  return (
    <div className="space-y-4">
      {showOverview && (
        <>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Agreement #{aid.toString()}</h4>
            <Badge variant={agreement.status === 4 ? "secondary" : agreement.status === 2 ? "warning" : "success"}>
              {AGR_STATUS[agreement.status]}
            </Badge>
            <span className="text-muted-foreground ml-auto text-xs">
              {isEmployer ? "You are the employer" : isFreelancer ? "You are the freelancer" : "Observer"}
            </span>
          </div>

          {/* Escrow */}
          <div className="bg-muted/40 grid grid-cols-3 gap-2 rounded-lg border p-3 text-center text-sm">
            <div>
              <div className="font-mono">{usdc(agreement.totalAmount)}</div>
              <div className="text-muted-foreground text-xs">Total</div>
            </div>
            <div>
              <div className="font-mono">{usdc(avail)}</div>
              <div className="text-muted-foreground text-xs">Escrow avail.</div>
            </div>
            <div>
              <div className="font-mono">{usdc(remaining)}</div>
              <div className="text-muted-foreground text-xs">Unallocated</div>
            </div>
          </div>
          {vault && (
            <div className="text-muted-foreground flex justify-between px-1 text-xs">
              <span>Deposited <span className="font-mono">{usdc(vault.deposited)}</span></span>
              <span>Released <span className="font-mono">{usdc(vault.released)}</span></span>
              <span>Refunded <span className="font-mono">{usdc(vault.refunded)}</span></span>
            </div>
          )}

          {/* Pull payments */}
          {claimable !== undefined && claimable > 0n && <WithdrawButton token={agreement.paymentToken} amount={claimable} invKeys={[["claimable", address, agreement.paymentToken]]} />}

          {/* Employer funding */}
          {isEmployer && active && <FundButton agreementId={aid} invKeys={invKeys} />}

          {/* Close */}
          {isEmployer && active && <CloseButtons agreementId={aid} jobId={agreement.jobId} invKeys={invKeys} />}

          {/* Dispute */}
          <Separator />
          <DisputeBlock agreementId={aid} dispute={dispute} canOpen={isParticipant && active} canSubmitEvidence={isParticipant} invKeys={invKeys} />
        </>
      )}

      {showWork && (
        <div className="space-y-4">
          {/* Employer adds milestones */}
          {isEmployer && active && remaining > 0n && (
            <AddWorkUnitButton agreementId={aid} units={units ?? []} max={remaining} invKeys={invKeys} />
          )}

          {/* Work units */}
          <div className="space-y-2">
            <h5 className="text-sm font-semibold">Work units ({units?.length ?? 0})</h5>
            {(units ?? []).map((u) => (
              <WorkUnitRow
                key={u.id.toString()}
                unit={u}
                isEmployer={isEmployer}
                isFreelancer={isFreelancer}
                active={active}
                available={avail}
                invKeys={invKeys}
              />
            ))}
            {(units?.length ?? 0) === 0 && <p className="text-muted-foreground text-sm">No work units yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

interface WithdrawButtonProps {
  token: Address;
  amount: bigint;
  invKeys: unknown[][];
}

export function WithdrawButton({ token, amount, invKeys }: WithdrawButtonProps) {
  const deflexy = useDeflexy();
  const tx = useTx();

  return (
    <div className="flex items-center gap-3  border border-border bg-accent p-2">
      <Icon 
        icon="solar:wallet-money-outline" 
        className="size-4 shrink-0 text-muted-foreground" 
      />
      
      <div className="flex flex-col">
        <span className="text-[11px] leading-none text-muted-foreground">
          Available
        </span>
        <span className="mt-1 font-mono text-sm font-semibold tabular-nums">
          {usdc(amount)}{" "}
          <span className="font-medium text-muted-foreground">USDC</span>
        </span>
      </div>

      <Button
        size="sm"
        className="ml-auto"
        loading={tx.busy}
        onClick={() =>
          deflexy &&
          tx.run(
            () => deflexy.write.withdraw(token),
            invKeys as any,
            "Funds withdrawn"
          )
        }
      >
        Withdraw
      </Button>
    </div>
  );
}
export function FundForm({ agreementId, invKeys, onDone }: { agreementId: bigint; invKeys: unknown[][]; onDone?: () => void }) {
  const deflexy = useDeflexy();
  const { address } = useAccount();
  const batch = useBatchTx();
  const [amt, setAmt] = useState("5");

  async function fund() {
    if (!deflexy || !address) return;
    const value = parseUnits(amt, 6);
    // Approve only when the standing allowance is short, and approve max so future
    // funding needs no approval. Both calls go in one confirmation when the wallet
    // supports EIP-5792 batching; otherwise they run sequentially.
    const allowance = await deflexy.read.allowance(USDC, address);
    const calls: Call[] = [];
    if (allowance < value) {
      calls.push({ address: USDC, abi: erc20Abi, functionName: "approve", args: [deflexy.addresses.vaultManager, maxUint256] });
    }
    calls.push({
      address: deflexy.addresses.agreementRegistry,
      abi: abis.AgreementRegistryAbi as unknown as Abi,
      functionName: "fundVault",
      args: [agreementId, value],
    });
    const ok = await batch.run(calls, invKeys as any, "Escrow funded");
    if (ok) onDone?.();
  }

  return (
    <div className="space-y-2">
      <Label>Fund escrow (USDC)</Label>
      <div className="flex gap-2">
        <Input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" />
        <Button onClick={fund} loading={batch.busy}>
          {batch.busy ? "Funding…" : "Fund"}
        </Button>
      </div>
      {batch.error && <p className="text-destructive text-xs">{batch.error}</p>}
    </div>
  );
}

export function AddWorkUnitForm({ agreementId, units, max, invKeys, onDone }: { agreementId: bigint; units: { sequence: bigint }[]; max: bigint; invKeys: unknown[][]; onDone?: () => void }) {
  const deflexy = useDeflexy();
  const tx = useTx();
  const [amt, setAmt] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const nextSeq = units.reduce((m, u) => (u.sequence > m ? u.sequence : m), 0n) + 1n;

  async function add() {
    if (!deflexy) return;
    const ok = await tx.run(async () => {
      const cid = await uploadAttachment(text, file);
      return deflexy.write.addWorkUnit(agreementId, nextSeq, parseUnits(amt || "0", 6), cid);
    }, invKeys as any, "Work unit added");
    setAmt("");
    setText("");
    setFile(null);
    if (ok) onDone?.();
  }
  return (
    <div className="space-y-2">
      <Label>Add work unit (≤ {usdc(max)})</Label>
      <Input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder="Amount (USDC)" />
      <AttachmentField label="Brief" text={text} setText={setText} file={file} setFile={setFile} placeholder="What this milestone covers…" />
      {tx.error && <p className="text-destructive text-xs">{tx.error}</p>}
      <Button onClick={add} loading={tx.busy} disabled={!amt} variant="secondary" className="w-full">
        {`Add work unit #${nextSeq.toString()}`}
      </Button>
    </div>
  );
}

export interface Unit {
  id: bigint;
  sequence: bigint;
  amount: bigint;
  status: number;
  metadataCID: Hex;
  submissionCID: Hex;
  submittedAt: bigint;
}

export function WorkUnitRow({
  unit,
  isEmployer,
  isFreelancer,
  active,
  available,
  invKeys,
}: {
  unit: Unit;
  isEmployer: boolean;
  isFreelancer: boolean;
  active: boolean;
  available: bigint;
  invKeys: unknown[][];
}) {
  const deflexy = useDeflexy();
  const tx = useTx();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const timedOut = unit.status === 3 && unit.submittedAt > 0n && now > unit.submittedAt + APPROVAL_WINDOW;
  const funded = available >= unit.amount;

  const act = (fn: () => Promise<Hex>, label: string) => tx.run(fn, invKeys as any, label);
  async function submitWork() {
    if (!deflexy) return;
    const okTx = await tx.run(
      async () => {
        const cid = await uploadAttachment(text, file);
        return deflexy.write.submitWork(unit.id, cid);
      },
      invKeys as any,
      "Work submitted",
    );
    if (okTx) {
      setOpen(false);
      setText("");
      setFile(null);
    }
  }

  return (
    <div className="bg-muted/40 space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground font-mono text-xs">#{unit.sequence.toString()}</span>
        <Badge variant={unit.status === 6 ? "secondary" : unit.status === 5 ? "success" : "outline"}>{WU_STATUS[unit.status]}</Badge>
        <span className="ml-auto font-mono">{usdc(unit.amount)}</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">Brief</span>
        <AttachmentLink cid={unit.metadataCID} />
        <span className="text-muted-foreground">Deliverable</span>
        <AttachmentLink cid={unit.submissionCID} />
      </div>

      {active && deflexy && (
        <div className="flex flex-wrap gap-2">
          {isFreelancer && unit.status === 1 && (
            <Button size="sm" loading={tx.busy} disabled={!funded} onClick={() => act(() => deflexy.write.startWork(unit.id), "Work started")}>
              {funded ? "Start work" : "Needs funding"}
            </Button>
          )}
          {isFreelancer && (unit.status === 2 || unit.status === 4) && (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              {unit.status === 4 ? "Resubmit" : "Submit work"}
            </Button>
          )}
          {isEmployer && unit.status === 3 && (
            <>
              <Button size="sm" loading={tx.busy} onClick={() => act(() => deflexy.write.approveWork(unit.id), "Work approved")}>
                Approve
              </Button>
              <Button size="sm" variant="outline" loading={tx.busy} onClick={() => act(() => deflexy.write.requestRevision(unit.id), "Revision requested")}>
                Request revision
              </Button>
            </>
          )}
          {timedOut && (
            <Button size="sm" variant="outline" loading={tx.busy} onClick={() => act(() => deflexy.write.claimApproval(unit.id), "Auto-approved")}>
              Force approve (timeout)
            </Button>
          )}
          {unit.status === 5 && (
            <Button size="sm" loading={tx.busy} onClick={() => act(() => deflexy.write.settleWorkUnit(unit.id), "Payment settled")}>
              Settle payment
            </Button>
          )}
        </div>
      )}

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={unit.status === 4 ? "Resubmit work" : "Submit work"}
        desc="Upload your deliverable for the client to review."
      >
        <div className="space-y-2">
          <AttachmentField label="Deliverable" text={text} setText={setText} file={file} setFile={setFile} placeholder="Notes, links…" />
          {tx.error && <p className="text-destructive text-xs">{tx.error}</p>}
          <Button className="w-full" loading={tx.busy} onClick={submitWork}>
            {tx.busy ? "Submitting…" : "Submit deliverable"}
          </Button>
        </div>
      </FormSheet>
      {tx.error && !open && <p className="text-destructive text-xs">{tx.error}</p>}
    </div>
  );
}

export function CloseButtons({ agreementId, jobId, invKeys }: { agreementId: bigint; jobId: bigint; invKeys: unknown[][] }) {
  const deflexy = useDeflexy();
  const tx = useTx();
  const keys = [...invKeys, ["agreement", jobId.toString()], ["job", jobId.toString()], ["jobs"]];
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" loading={tx.busy} onClick={() => deflexy && tx.run(() => deflexy.write.completeAgreement(agreementId), keys as any, "Agreement completed")}>
        Complete agreement
      </Button>
      <Button size="sm" variant="ghost" loading={tx.busy} onClick={() => deflexy && tx.run(() => deflexy.write.terminateAgreement(agreementId), keys as any, "Agreement terminated")}>
        Terminate
      </Button>
      {tx.error && <p className="text-destructive text-xs">{tx.error}</p>}
    </div>
  );
}

interface Payment {
  id: string;
  kind: string; // deposit | release | refund | fee
  account: Address | null;
  amount: string;
  txHash: Hex;
}
const PAY_META: Record<string, { label: string; variant: "success" | "info" | "warning" | "secondary"; sign: string }> = {
  deposit: { label: "Deposit", variant: "info", sign: "+" },
  release: { label: "Release", variant: "success", sign: "−" },
  refund: { label: "Refund", variant: "warning", sign: "−" },
  fee: { label: "Fee", variant: "secondary", sign: "−" },
};

/** Per-agreement money ledger from the indexer (deposits/releases/refunds/fees). */
export function PaymentHistory({ vaultId }: { vaultId: bigint }) {
  const deflexy = useDeflexy();
  const { data, isError } = useQuery({
    queryKey: ["payments", vaultId.toString()],
    enabled: !!deflexy,
    retry: false,
    refetchInterval: 12000,
    queryFn: async () => {
      const d = (await deflexy!.query.paymentsForVault(vaultId)) as { payments: { items: Payment[] } };
      return d.payments.items;
    },
  });
  if (isError) return <p className="text-muted-foreground text-sm">Indexer offline — payment history unavailable.</p>;
  if (!data) return <div className="bg-surface/60 h-20 animate-pulse rounded-lg" />;
  if (data.length === 0) return <p className="text-muted-foreground text-sm">No payments yet.</p>;
  return (
    <div className="space-y-2">
      <div className="bg-card divide-border overflow-hidden rounded-lg border divide-y">
        {data.map((p) => {
          const m = PAY_META[p.kind] ?? { label: p.kind, variant: "secondary" as const, sign: "" };
          return (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-xs">
              <Badge variant={m.variant} size="xs">{m.label}</Badge>
              <a
                href={`https://sepolia.basescan.org/tx/${p.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground font-mono"
              >
                {p.account ? short(p.account) : "—"}
              </a>
              <span className="ml-auto font-mono font-medium">{m.sign}{usdc(BigInt(p.amount))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DISPUTE_STATUS = ["None", "Open", "Under review", "Resolved", "Dismissed"];
const DISPUTE_OUTCOME = ["—", "Employer prevails", "Freelancer prevails", "Split", "Terminated"];

interface Dispute {
  id: bigint;
  status: number;
  outcome: number;
  initiator: Address;
  evidenceCID: Hex;
  resolutionCID: Hex;
  createdAt: bigint;
  resolvedAt: bigint;
}

function DisputeBlock({
  agreementId,
  dispute,
  canOpen,
  canSubmitEvidence,
  invKeys,
}: {
  agreementId: bigint;
  dispute: Dispute | null | undefined;
  canOpen: boolean;
  canSubmitEvidence: boolean;
  invKeys: unknown[][];
}) {
  const deflexy = useDeflexy();
  const tx = useTx();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const keys = [...invKeys, ["dispute", agreementId.toString()]];

  if (dispute) {
    const resolved = dispute.status === 3 || dispute.status === 4;
    async function addEvidence() {
      if (!deflexy) return;
      const okTx = await tx.run(
        async () => {
          const cid = await uploadAttachment(text, file);
          return deflexy.write.submitEvidence(dispute!.id, cid);
        },
        keys as any,
        "Evidence submitted",
      );
      if (okTx) {
        setOpen(false);
        setText("");
        setFile(null);
      }
    }
    const decided = dispute.status === 3 && dispute.outcome > 0;
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <h5 className="font-semibold">Dispute #{dispute.id.toString()}</h5>
          <Badge variant={dispute.status === 3 ? "secondary" : dispute.status === 4 ? "outline" : "warning"}>
            {DISPUTE_STATUS[dispute.status]}
          </Badge>
        </div>
        <div className="bg-muted/40 space-y-1.5 rounded-lg border p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Opened by</span>
            <span className="ml-auto font-mono">{short(dispute.initiator)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Evidence</span>
            <span className="ml-auto"><AttachmentLink cid={dispute.evidenceCID} /></span>
          </div>
          {decided && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Outcome</span>
                <Badge variant="success" size="xs" className="ml-auto">{DISPUTE_OUTCOME[dispute.outcome]}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Ruling</span>
                <span className="ml-auto"><AttachmentLink cid={dispute.resolutionCID} label="Read" /></span>
              </div>
            </>
          )}
        </div>
        <p className="text-muted-foreground text-xs">Resolution is handled by the protocol arbitrator.</p>
        {canSubmitEvidence && !resolved && (
          <>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Icon icon="solar:document-add-outline" className="size-4" /> Submit evidence
            </Button>
            <FormSheet open={open} onOpenChange={setOpen} title="Submit evidence" desc="Add supporting evidence to the dispute.">
              <div className="space-y-2">
                <AttachmentField label="Evidence" text={text} setText={setText} file={file} setFile={setFile} placeholder="Add supporting evidence…" />
                {tx.error && <p className="text-destructive text-xs">{tx.error}</p>}
                <Button className="w-full" loading={tx.busy} onClick={addEvidence}>
                  {tx.busy ? "Submitting…" : "Submit evidence"}
                </Button>
              </div>
            </FormSheet>
          </>
        )}
      </div>
    );
  }
  if (!canOpen) return null;

  async function openDispute() {
    if (!deflexy) return;
    const okTx = await tx.run(
      async () => {
        const cid = await uploadAttachment(text, file);
        return deflexy.write.openDispute(agreementId, cid);
      },
      keys as any,
      "Dispute opened",
    );
    if (okTx) setOpen(false);
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" className="text-muted-foreground" onClick={() => setOpen(true)}>
        <Icon icon="solar:shield-warning-outline" className="size-4" /> Open a dispute
      </Button>
      <FormSheet open={open} onOpenChange={setOpen} title="Open a dispute" desc="Escalate to the protocol arbitrator with your evidence.">
        <div className="space-y-2">
          <AttachmentField label="Evidence" text={text} setText={setText} file={file} setFile={setFile} placeholder="Describe the issue…" />
          {tx.error && <p className="text-destructive text-xs">{tx.error}</p>}
          <Button variant="destructive" className="w-full" loading={tx.busy} onClick={openDispute}>
            {tx.busy ? "Submitting…" : "Open dispute"}
          </Button>
        </div>
      </FormSheet>
    </div>
  );
}
