import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useChainId, useConnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { baseSepolia } from "wagmi/chains";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useDeflexy } from "@/deflexy";
import { useProfileId, useTx, withUploadToast } from "@/hooks";
import { uploadProfileMeta } from "@/lib/ipfs";
import { type Role } from "@/components/RoleSwitcher";
import { cn } from "@/lib/utils";

const STEPS = ["Connect", "Network", "Profile"];

const VALUE_PROPS = [
  { icon: "solar:lock-keyhole-minimalistic-bold-duotone", text: "Funds held in on-chain escrow until work is approved" },
  { icon: "solar:medal-ribbons-star-bold-duotone", text: "Portable, on-chain reputation you actually own" },
  { icon: "solar:shield-check-bold-duotone", text: "Private briefs & proposals, gated to the platform" },
];

/** Full-screen gate: walks a visitor through connect → correct network → profile. */
export function Onboarding({ role, setRole }: { role: Role; setRole: (r: Role) => void }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const wrongNetwork = isConnected && chainId !== baseSepolia.id;
  const { data: profileId } = useProfileId();
  const loadingProfile = isConnected && !wrongNetwork && profileId === undefined;

  const step = !isConnected ? 0 : wrongNetwork ? 1 : 2;

  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-96 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        style={{ background: "radial-gradient(700px 320px at 50% -60px, var(--color-primary), transparent 70%)", opacity: 0.14 }}
      />

      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <img src="/logo/DeFlexy-Icon2.svg" alt="Deflexy" className="size-10" />
          <span className="text-sm font-semibold tracking-tight">Deflexy</span>
        </div>
        <ThemeSwitcher />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Stepper */}
          <div className="mb-6 flex items-center">
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <div key={label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold transition",
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : active
                            ? "border-primary text-primary ring-primary/20 ring-4"
                            : "border-border text-muted-foreground",
                      )}
                    >
                      {done ? <Icon icon="solar:check-bold" className="size-3.5" /> : i + 1}
                    </span>
                    <span className={cn("text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn("mx-2 h-0.5 flex-1 rounded-full", i < step ? "bg-primary" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-card rounded-2xl border p-6 shadow-sm">
            {step === 0 && <ConnectStep />}
            {step === 1 && <NetworkStep />}
            {step === 2 && (loadingProfile ? <LoadingStep /> : <ProfileStep role={role} setRole={setRole} />)}
          </div>

          <p className="text-muted-foreground mt-4 text-center text-xs">
            Testnet on Base Sepolia · no real funds. You stay in control of your wallet.
          </p>
        </div>
      </main>
    </div>
  );
}

function ConnectStep() {
  const { connect, isPending } = useConnect();
  return (
    <div className="space-y-5 text-center">
      <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-2xl">
        <Icon icon="solar:wallet-bold-duotone" className="size-7" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Welcome to Deflexy</h1>
        <p className="text-muted-foreground text-sm">The on-chain freelance marketplace. Connect a wallet to get started.</p>
      </div>
      <div className="space-y-2.5 text-left">
        {VALUE_PROPS.map((v) => (
          <div key={v.text} className="flex items-center gap-2.5">
            <Icon icon={v.icon} className="text-primary size-5 shrink-0" />
            <span className="text-muted-foreground text-sm">{v.text}</span>
          </div>
        ))}
      </div>
      <Button size="lg" className="w-full" loading={isPending} onClick={() => connect({ connector: injected() })}>
        <Icon icon="ic:baseline-wallet" className="size-5" /> {isPending ? "Connecting…" : "Connect Wallet"}
      </Button>
    </div>
  );
}

function NetworkStep() {
  const { switchChain, isPending } = useSwitchChain();
  return (
    <div className="space-y-5 text-center">
      <div className="bg-warning/10 text-warning mx-auto flex size-14 items-center justify-center rounded-2xl">
        <Icon icon="solar:planet-bold-duotone" className="size-7" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight">Switch network</h1>
        <p className="text-muted-foreground text-sm">Deflexy runs on Base Sepolia. Switch to continue.</p>
      </div>
      <Button size="lg" className="w-full" loading={isPending} onClick={() => switchChain({ chainId: baseSepolia.id })}>
        <Icon icon="token-branded:base" className="size-5" /> Switch to Base Sepolia
      </Button>
    </div>
  );
}

function LoadingStep() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Icon icon="svg-spinners:90-ring-with-bg" className="text-muted-foreground size-7" />
      <p className="text-muted-foreground text-sm">Checking your profile…</p>
    </div>
  );
}

const ROLE_CARDS: { role: Role; title: string; desc: string; icon: string }[] = [
  { role: "freelancer", title: "Find work", desc: "Browse jobs and send proposals", icon: "solar:user-speak-rounded-bold-duotone" },
  { role: "client", title: "Hire talent", desc: "Post jobs and review proposals", icon: "solar:user-hand-up-bold-duotone" },
];

function ProfileStep({ role, setRole }: { role: Role; setRole: (r: Role) => void }) {
  const deflexy = useDeflexy();
  const { address } = useAccount();
  const qc = useQueryClient();
  const tx = useTx();
  const [name, setName] = useState("");
  const [pick, setPick] = useState<Role>(role);

  async function create() {
    if (!deflexy || !address || !name.trim()) return;
    let ref: `0x${string}`;
    try {
      ref = await withUploadToast(uploadProfileMeta(name.trim(), ""), "Saving profile…");
    } catch (e) {
      tx.setError(e instanceof Error ? e.message : "Upload failed");
      return;
    }
    // Don't invalidate inside tx.run: the RPC can still return profileOf=0n right after the
    // receipt (read lag), react-query would cache that 0n, and the gate would never lift.
    const ok = await tx.run(() => deflexy.write.createProfile(ref), [], "Profile created");
    if (!ok) return;
    setRole(pick);
    // Poll until the new profile is actually readable, then refresh the gate.
    for (let i = 0; i < 12; i++) {
      if (((await deflexy.read.profileOf(address)) ?? 0n) !== 0n) break;
      await new Promise((r) => setTimeout(r, 600));
    }
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center">
        <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-2xl">
          <Icon icon="solar:user-plus-bold-duotone" className="size-7" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">Create your profile</h1>
        <p className="text-muted-foreground text-sm">A one-time on-chain identity. You can edit it later.</p>
      </div>

      <div className="space-y-2">
        <span className="text-muted-foreground text-xs font-medium">I want to…</span>
        <div className="grid grid-cols-2 gap-2">
          {ROLE_CARDS.map((c) => (
            <button
              key={c.role}
              type="button"
              onClick={() => setPick(c.role)}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                pick === c.role ? "border-primary bg-primary/5 ring-primary/30 ring-1" : "hover:bg-surface/60",
              )}
            >
              <Icon
                icon={c.icon}
                className={cn("size-6", pick === c.role ? "text-primary" : "text-muted-foreground")}
              />
              <div className="mt-1.5 text-sm font-medium">{c.title}</div>
              <div className="text-muted-foreground text-xs">{c.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-muted-foreground text-xs font-medium">Display name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada Lovelace" autoFocus />
      </div>

      {tx.error && <p className="text-destructive text-sm">{tx.error}</p>}

      <Button size="lg" className="w-full" loading={tx.busy} disabled={!name.trim()} onClick={create}>
        Create profile & enter
      </Button>
      <p className="text-muted-foreground text-center text-[11px]">
        Signs one message (to store your profile) and one transaction (to register it).
      </p>
    </div>
  );
}
