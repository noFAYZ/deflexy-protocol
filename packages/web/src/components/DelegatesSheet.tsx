import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useDeflexy } from "@/deflexy";
import { useTx } from "@/hooks";
import { cn } from "@/lib/utils";

// Mirrors src/libraries/Capabilities.sol (bit positions).
const CAPS = [
  { bit: 1n << 0n, label: "Create jobs" },
  { bit: 1n << 1n, label: "Cancel jobs" },
  { bit: 1n << 2n, label: "Submit bids" },
  { bit: 1n << 3n, label: "Accept bids" },
  { bit: 1n << 4n, label: "Fund vaults" },
  { bit: 1n << 5n, label: "Submit work" },
  { bit: 1n << 6n, label: "Approve work" },
  { bit: 1n << 7n, label: "Open disputes" },
  { bit: 1n << 8n, label: "Manage profile" },
];

const EXPIRY = [
  { label: "Never", days: 0 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

/** Grant/revoke delegated permissions for a profile, by delegate address. The chain keeps
 * one grant per (profile, delegate) and there's no on-chain enumeration, so this looks a
 * delegate up by address rather than listing all of them. */
export function DelegatesSheet({
  open,
  onOpenChange,
  profileId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: bigint;
}) {
  const deflexy = useDeflexy();
  const tx = useTx();
  const [addr, setAddr] = useState("");
  const [mask, setMask] = useState(0n);
  const [days, setDays] = useState(0);

  const valid = isAddress(addr);
  const grantKey = ["grant", profileId.toString(), addr];

  // Look up any existing grant for this delegate, so it can be edited/revoked.
  const { data: grant } = useQuery({
    queryKey: grantKey,
    enabled: !!deflexy && valid,
    queryFn: () => deflexy!.read.getGrant(profileId, addr as Address) as Promise<{ mask: bigint; expiration: bigint }>,
  });
  const hasGrant = !!grant && grant.mask > 0n;

  // When a delegate is looked up, seed the editor from their current grant.
  function pick(a: string) {
    setAddr(a);
    setMask(0n);
  }

  const effectiveMask = mask || (hasGrant ? grant!.mask : 0n);

  async function save() {
    if (!deflexy || !valid || effectiveMask === 0n) return;
    const expiration = days === 0 ? 0n : BigInt(Math.floor(Date.now() / 1000) + days * 86400);
    const ok = await tx.run(
      () => deflexy.write.grantPermission(profileId, addr as Address, effectiveMask, expiration),
      [grantKey],
      "Permission granted",
    );
    if (ok) setMask(0n);
  }
  async function revoke() {
    if (!deflexy || !valid) return;
    await tx.run(() => deflexy.write.revokePermission(profileId, addr as Address), [grantKey], "Permission revoked");
    setMask(0n);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Delegate access</SheetTitle>
          <SheetDescription>Let another wallet act for your profile, without transferring ownership.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delegate">Delegate address</Label>
            <Input id="delegate" value={addr} onChange={(e) => pick(e.target.value.trim())} placeholder="0x…" className="font-mono" />
            {addr && !valid && <p className="text-destructive text-xs">Not a valid address.</p>}
          </div>

          {valid && (
            <>
              {hasGrant && (
                <div className="border-info/40 bg-info/10 flex items-center gap-2 rounded-lg border p-3 text-xs">
                  <Icon icon="solar:shield-check-outline" className="size-4 shrink-0" />
                  This delegate already has access{grant!.expiration > 0n ? ` until ${new Date(Number(grant!.expiration) * 1000).toLocaleDateString()}` : ""}.
                </div>
              )}

              <div className="space-y-2">
                <Label>Capabilities</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CAPS.map((c) => {
                    const checked = (effectiveMask & c.bit) === c.bit;
                    return (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => setMask((effectiveMask ^ c.bit))}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition",
                          checked ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface/60",
                        )}
                      >
                        <Icon icon={checked ? "solar:check-square-bold" : "solar:stop-outline"} className="size-4 shrink-0" />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Expires</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {EXPIRY.map((e) => (
                    <button
                      key={e.days}
                      type="button"
                      onClick={() => setDays(e.days)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-sm font-medium transition",
                        days === e.days ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface",
                      )}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              {tx.error && <p className="text-destructive text-sm">{tx.error}</p>}

              <div className="flex gap-2">
                <Button onClick={save} loading={tx.busy} disabled={effectiveMask === 0n} className="flex-1">
                  {hasGrant ? "Update grant" : "Grant access"}
                </Button>
                {hasGrant && (
                  <Button variant="outline" onClick={revoke} loading={tx.busy}>
                    Revoke
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
