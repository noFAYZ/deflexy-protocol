import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseUnits } from "viem";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDeflexy, USDC } from "@/deflexy";
import { useTx } from "@/hooks";
import { uploadBrief } from "@/lib/ipfs";
import { MODELS } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS = ["Details", "Settlement", "Budget"];
const BUDGET_PRESETS = [10, 50, 100, 500];
const MODEL_META = [
  { icon: "solar:dollar-minimalistic-bold-duotone", desc: "One payment for the whole job." },
  { icon: "solar:checklist-minimalistic-bold-duotone", desc: "Pay in stages as work is approved." },
  { icon: "solar:clock-circle-bold-duotone", desc: "Pay for time logged." },
  { icon: "solar:refresh-circle-bold-duotone", desc: "Recurring payments over time." },
];

export function CreateJobDialog() {
  const { address } = useAccount();
  const deflexy = useDeflexy();
  const tx = useTx();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState("50");
  const [model, setModel] = useState(0);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: profileId } = useQuery({
    queryKey: ["profile", address],
    enabled: !!deflexy && !!address,
    queryFn: () => deflexy!.read.profileOf(address!),
  });
  const hasProfile = !!profileId && profileId !== 0n;

  const budgetNum = Number(budget);
  const validBudget = Number.isFinite(budgetNum) && budgetNum > 0;
  const validTitle = title.trim().length > 0;
  const stepValid = [validTitle, true, validBudget][step];

  function openSheet(v: boolean) {
    setOpen(v);
    if (v) {
      setStep(0);
      tx.setError("");
    }
  }

  async function create() {
    if (!deflexy || !profileId || !validTitle || !validBudget) return;
    let ref: `0x${string}`;
    setUploading(true);
    try {
      // Brief → private Pinata storage (prompts a wallet sign-in on first use).
      const r = await uploadBrief(title.trim(), desc, file ? [file] : []);
      ref = r.ref;
      // Prime the cache so the feed/detail render the title immediately, no refetch.
      queryClient.setQueryData(["brief", r.ref], r.brief);
    } catch (err) {
      tx.setError(err instanceof Error ? err.message : "Brief upload failed");
      return;
    } finally {
      setUploading(false);
    }
    const ok = await tx.run(
      () => deflexy.write.createJob(profileId, USDC, parseUnits(budget, 6), model, ref),
      [["jobs"]],
      "Job created",
    );
    if (ok) {
      setTitle("");
      setDesc("");
      setFile(null);
      setStep(0);
      setOpen(false);
    }
  }

  // Enter / primary button: advance steps, then create on the last.
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stepValid) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else create();
  }

  return (
    <>
      <Button className="w-full" disabled={!hasProfile} onClick={() => openSheet(true)}>
        <Icon icon="solar:add-circle-outline" className="size-5" /> Create Job
      </Button>

      <Sheet open={open} onOpenChange={openSheet} >
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Icon icon="solar:case-minimalistic-bold-duotone" className="text-primary size-5" /> Post a job
            </SheetTitle>
            <SheetDescription>Funds are escrowed in USDC and released as work is approved.</SheetDescription>
          </SheetHeader>

          {/* Stepper */}
<div className="mt-6 mx-auto w-full max-w-xs">
  <div className="relative flex items-start">
    {STEPS.map((label, i) => {
      const done = i < step;
      const active = i === step;
      const isLast = i === STEPS.length - 1;

      return (
        <Fragment key={label}>
          {/* Step Node */}
          <button
            type="button"
            onClick={() => done && setStep(i)}
            disabled={!done}
            aria-current={active ? "step" : undefined}
            aria-label={`Step ${i + 1}: ${label}${done ? " (completed)" : ""}${active ? " (current)" : ""}`}
            className={cn(
              "group relative flex flex-col items-center gap-2.5",
              "outline-none rounded-lg",
          
            )}
          >
    

            {/* Circle */}
            <span
              className={cn(
                "relative z-10 flex size-5 items-center justify-center rounded-full",
                "transition-all duration-100 ease-out",
                done && [
                  "bg-lime-600 text-white",
                  "shadow-sm shadow-lime-600/25",
                  "group-hover:shadow-md group-hover:shadow-lime-600/30",
                  "group-hover:scale-105",
                ],
                active && [
                  "bg-background text-lime-600",
                  "border-2 border-lime-600 ring-offset-2 ring-offset-background",
                ],
                !done && !active && [
                  "bg-muted text-muted-foreground/60",
                ]
              )}
            >
              {done ? (
                <Icon
                  icon="solar:check-read-linear"
                  className="size-4"
                />
              ) : (
                <span className="text-xs font-semibold tabular-nums">
                  {i + 1}
                </span>
              )}
            </span>

          </button>

          {/* Connector */}
          {!isLast && (
            <div className="relative mt-[12px] mx-1 h-[2px] flex-1 rounded-full bg-muted overflow-hidden">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full bg-lime-600",
                  "transition-all duration-500 ease-out",
                  done ? "w-full" : "w-0"
                )}
              />
            </div>
          )}
        </Fragment>
      );
    })}
  </div>
</div>

          <form onSubmit={onSubmit} className="mt-5 flex flex-1 flex-col">
            <div className="flex-1 space-y-4">
              {/* Step 1 — details */}
              {step === 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="job-title">Title</Label>
                    <Input
                      id="job-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Build a landing page in React"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job-desc">Brief</Label>
                    <Textarea
                      id="job-desc"
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      rows={6}
                      placeholder="Scope, deliverables, and expectations. Stored privately — only signed-in users can read it."
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Attachment (optional)</Label>
                    <label className="border-input text-muted-foreground hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition">
                      <Icon icon="solar:paperclip-outline" className="size-4 shrink-0" />
                      <span className="truncate">{file?.name ?? "Attach a file"}</span>
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
                </>
              )}

              {/* Step 2 — settlement model */}
              {step === 1 && (
                <div className="space-y-2">
                  {MODELS.map((m, i) => {
                    const active = model === i;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setModel(i)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                          active ? "border-primary bg-primary/5 ring-primary/30 ring-1" : "hover:bg-surface/60",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg",
                            active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon icon={MODEL_META[i]?.icon ?? "solar:dollar-minimalistic-bold-duotone"} className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{m}</div>
                          <div className="text-muted-foreground text-xs">{MODEL_META[i]?.desc}</div>
                        </div>
                        <Icon
                          icon="solar:check-circle-bold"
                          className={cn("text-primary size-5 shrink-0", active ? "opacity-100" : "opacity-0")}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 3 — budget */}
              {step === 2 && (
                <div className="bg-surface/40 rounded-2xl p-5">
                  <div className="text-muted-foreground text-center text-xs font-medium tracking-wide uppercase">
                    Budget
                  </div>
                  <div className="mt-2 flex items-baseline justify-center gap-1.5">
                    <input
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      autoFocus
                      style={{ width: `${Math.max(budget.length, 1)}ch` }}
                      className="caret-primary min-w-[1ch] bg-transparent text-center text-4xl font-bold tracking-tight outline-none"
                    />
                    <span className="text-muted-foreground text-xl font-semibold">USDC</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-center text-xs">
                    {validBudget ? "Escrowed when a proposal is accepted" : "Enter a budget"}
                  </p>
                  <div className="mt-3 flex justify-center gap-1.5">
                    {BUDGET_PRESETS.map((v) => (
                      <Chip key={v} active={budget === String(v)} onClick={() => setBudget(String(v))}>
                        {v}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {tx.error && <p className="text-destructive text-sm">{tx.error}</p>}
            </div>

            {/* Nav */}
            <div className="mt-6 flex gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={tx.busy || uploading}>
                  <Icon icon="solar:arrow-left-linear" /> Back
                </Button>
              )}
              <Button type="submit" className="flex-1" disabled={!stepValid} loading={tx.busy || uploading}>
                {step < STEPS.length - 1 ? "Continue" : uploading ? "Uploading brief…" : "Create Job"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
        active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
