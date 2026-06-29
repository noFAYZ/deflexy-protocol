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
import { uploadBrief, normalizeTags, type UploadPhase } from "@/lib/ipfs";
import { CATEGORIES, MODELS } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS = ["Details", "Settlement", "Budget"];
const BUDGET_PRESETS = [10, 50, 100, 500];
const MODEL_META = [
  { icon: "solar:dollar-minimalistic-bold-duotone", desc: "One payment for the whole job." },
  { icon: "solar:checklist-minimalistic-bold-duotone", desc: "Pay in stages as work is approved." },
];

const PHASE_ORDER = ["files", "brief", "tx"] as const;
type Phase = (typeof PHASE_ORDER)[number];

/** Live checklist shown while a job is being submitted: attachment upload → brief
 * pinning → on-chain tx, each ticking from spinner to check. Private pinning is
 * a few seconds, so showing the real stage beats one opaque spinner. */
function SubmitProgress({ phase, hasFile }: { phase: Phase; hasFile: boolean }) {
  const idx = PHASE_ORDER.indexOf(phase);
  const steps = [
    ...(hasFile ? [{ key: "files" as const, label: "Uploading attachment" }] : []),
    { key: "brief" as const, label: "Storing brief privately" },
    { key: "tx" as const, label: "Creating job on-chain" },
  ];
  return (
    <div className="bg-muted/40 mt-4 space-y-2 rounded-lg border p-3">
      {steps.map((s) => {
        const sIdx = PHASE_ORDER.indexOf(s.key);
        const done = idx > sIdx;
        const active = idx === sIdx;
        return (
          <div key={s.key} className="flex items-center gap-2.5 text-sm">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full",
                done ? "bg-lime-600 text-white" : active ? "text-lime-600" : "text-muted-foreground/40",
              )}
            >
              {done ? (
                <Icon icon="solar:check-read-linear" className="size-3.5" />
              ) : active ? (
                <Icon icon="solar:refresh-linear" className="size-3.5 animate-spin" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>
            <span className={cn(done && "text-muted-foreground line-through", active && "font-medium")}>{s.label}</span>
          </div>
        );
      })}
      <p className="text-muted-foreground pt-0.5 text-xs">Private storage can take a few seconds — keep this open.</p>
    </div>
  );
}

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
  const [category, setCategory] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  // null when idle; otherwise the current submit stage for the progress checklist.
  const [phase, setPhase] = useState<UploadPhase | "tx" | null>(null);

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
      setPhase(null);
      tx.setError("");
    }
  }

  async function create() {
    if (!deflexy || !profileId || !validTitle || !validBudget) return;
    let ref: `0x${string}`;
    setUploading(true);
    try {
      // Fold any half-typed tag into the set before submitting.
      const allTags = normalizeTags(tagInput.trim() ? [...tags, tagInput] : tags);
      // Brief → private Pinata storage (prompts a wallet sign-in on first use).
      const r = await uploadBrief(title.trim(), desc, file ? [file] : [], setPhase, {
        category: category || undefined,
        tags: allTags,
      });
      ref = r.ref;
      // Prime the cache so the feed/detail render the title immediately, no refetch.
      queryClient.setQueryData(["brief", r.ref], r.brief);
    } catch (err) {
      tx.setError(err instanceof Error ? err.message : "Brief upload failed");
      setPhase(null);
      return;
    } finally {
      setUploading(false);
    }
    setPhase("tx");
    const ok = await tx.run(
      () => deflexy.write.createJob(profileId, USDC, parseUnits(budget, 6), model, ref),
      [["jobs"]],
      "Job created",
    );
    setPhase(null);
    if (ok) {
      setTitle("");
      setDesc("");
      setCategory("");
      setTags([]);
      setTagInput("");
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
        <Icon icon="solar:add-circle-outline" className="size-5" /> Post Job
      </Button>

      <Sheet open={open} onOpenChange={openSheet} >

        
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
                {/* Stepper */}
<div className="  mx-auto w-full max-w-[16rem]">
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
 
          </SheetHeader>



          <form onSubmit={onSubmit} className="mt-12 flex flex-1 flex-col">
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
                    <Label>Category</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map((c) => (
                        <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? "" : c)}>
                          {c}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job-tags">Tags (optional)</Label>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTags(tags.filter((x) => x !== t))}
                            className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition"
                          >
                            {t}
                            <Icon icon="solar:close-circle-bold" className="size-3.5" />
                          </button>
                        ))}
                      </div>
                    )}
                    <Input
                      id="job-tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                          e.preventDefault();
                          setTags((prev) => normalizeTags([...prev, tagInput]));
                          setTagInput("");
                        } else if (e.key === "Backspace" && !tagInput && tags.length) {
                          setTags(tags.slice(0, -1));
                        }
                      }}
                      placeholder={tags.length >= 6 ? "Max 6 tags" : "Type a tag, press Enter"}
                      disabled={tags.length >= 6}
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

            {phase && <SubmitProgress phase={phase} hasFile={!!file} />}

            {/* Nav */}
            <div className="mt-6 flex gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={tx.busy || uploading}>
                  <Icon icon="solar:arrow-left-linear" /> Back
                </Button>
              )}
              <Button type="submit" className="flex-1" disabled={!stepValid} loading={tx.busy || uploading}>
                {step < STEPS.length - 1
                  ? "Continue"
                  : uploading
                    ? "Uploading brief…"
                    : tx.busy
                      ? "Creating job…"
                      : "Create Job"}
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
