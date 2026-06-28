import { useState, type Dispatch, type SetStateAction } from "react";
import { Icon } from "@iconify/react";
import type { Hex } from "viem";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { accessLink, isEmptyCid } from "@/lib/ipfs";

/** Text + optional file input for proposals / deliverables / evidence. */
export function AttachmentField({
  label,
  text,
  setText,
  file,
  setFile,
  placeholder,
}: {
  label: string;
  text: string;
  setText: Dispatch<SetStateAction<string>>;
  file: File | null;
  setFile: Dispatch<SetStateAction<File | null>>;
  placeholder?: string;
}) {
  const [name, setName] = useState<string>("");
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} rows={3} />
      <div className="flex items-center gap-2">
        <label className="border-input text-muted-foreground hover:bg-accent inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs">
          <Icon icon="solar:paperclip-outline" className="size-3.5" />
          {name || "Attach file"}
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setName(f?.name ?? "");
            }}
          />
        </label>
        <span className="text-muted-foreground text-xs">→ private (Pinata)</span>
      </div>
    </div>
  );
}

/** Opens a private ref via a freshly-minted signed access link (gated by sign-in). */
export function AttachmentLink({ cid, label = "View" }: { cid?: Hex | null; label?: string }) {
  const [busy, setBusy] = useState(false);
  if (isEmptyCid(cid)) return <span className="text-muted-foreground text-xs">none</span>;
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          window.open(await accessLink(cid!), "_blank", "noopener");
        } finally {
          setBusy(false);
        }
      }}
      className="text-primary inline-flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
    >
      {busy ? (
        <Icon icon="svg-spinners:90-ring-with-bg" className="size-3" />
      ) : (
        <Icon icon="solar:arrow-right-up-linear" className="size-3" />
      )}{" "}
      {label}
    </button>
  );
}
