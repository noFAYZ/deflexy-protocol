import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, keccak256, toBytes } from "viem";
import { Icon } from "@iconify/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDeflexy } from "@/deflexy";
import { useTx } from "@/hooks";
import { short } from "@/lib/format";

export function ProfileCard() {
  const { address, isConnected } = useAccount();
  const deflexy = useDeflexy();
  const tx = useTx();

  const { data: profileId, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["profile", address],
    enabled: !!deflexy && !!address,
    queryFn: () => deflexy!.read.profileOf(address!),
  });

  const hasProfile = !!profileId && profileId !== 0n;

  const { data: rep, isLoading: isLoadingRep } = useQuery({
    queryKey: ["reputation", profileId?.toString()],
    enabled: !!deflexy && hasProfile,
    retry: false,
    queryFn: async () => {
      try {
        const d = (await deflexy!.query.reputation(profileId!)) as {
          reputation: {
            completedAsFreelancer: string;
            completedAsEmployer: string;
            volumeAsFreelancer: string;
          } | null;
        };
        return d.reputation;
      } catch {
        return null;
      }
    },
  });

  async function createProfile() {
    if (!deflexy || !address) return;
    await tx.run(
      () => deflexy.write.createProfile(keccak256(toBytes(`profile:${address}`))),
      [["profile"]],
      "Profile created"
    );
  }

  // ─── Disconnected State ─────────────────────────────────
  if (!isConnected) {
    return (
      <Card className="overflow-hidden border-0 p-0">
        <div className="relative bg-gradient-to-br from-muted via-muted/50 to-background">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
          <CardContent className="relative flex flex-col items-center gap-4 px-6 py-10 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-inset ring-border/50 backdrop-blur-sm">
              <Icon
                icon="solar:wallet-bold-duotone"
                className="size-7 text-muted-foreground/70"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground/90">
                No Wallet Connected
              </p>
              <p className="max-w-[200px] text-xs leading-relaxed text-muted-foreground">
                Connect your wallet to view your identity and track reputation.
              </p>
            </div>
          </CardContent>
        </div>
      </Card>
    );
  }

  const isLoading = isLoadingProfile || isLoadingRep;
  const completed =
    Number(rep?.completedAsFreelancer ?? 0) +
    Number(rep?.completedAsEmployer ?? 0);
  const volume = formatUnits(BigInt(rep?.volumeAsFreelancer ?? "0"), 6);
  const tier = getTier(completed);

  // ─── Connected State ────────────────────────────────────
  return (
    <Card className="overflow-hidden border-0 p-0">
      {/* Banner */}
      <div className="relative h-20 overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-info/10">
        <div className="absolute -inset-1 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent blur-xl" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
      </div>

      <CardContent className="relative -mt-8 space-y-5 px-5 pb-5">
        {/* Avatar + Identity */}
        <div className="flex items-end gap-3.5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="flex size-[60px] items-center justify-center rounded-2xl text-lg font-bold shadow-lg ring-4 ring-background transition-transform hover:scale-[1.02]"
              style={
                hasProfile
                  ? {
                      background:
                        "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary/80) 50%, var(--color-info) 100%)",
                      color: "white",
                    }
                  : {
                      background: "var(--color-muted)",
                      color: "var(--color-muted-foreground)",
                    }
              }
            >
              {hasProfile ? (
                <span className="text-base">#</span>
              ) : (
                <Icon icon="solar:user-bold-duotone" className="size-6" />
              )}
            </div>

            {/* Tier badge */}
            {hasProfile && tier.icon && (
              <div className="absolute -bottom-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-background ring-2 ring-border">
                <Icon
                  icon={tier.icon}
                  className={`size-3.5 ${tier.color}`}
                />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 pb-1">
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-36 animate-pulse rounded-md bg-muted" />
                <div className="h-3 w-28 animate-pulse rounded-md bg-muted" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold tracking-tight">
                    {hasProfile
                      ? `Profile #${profileId!.toString()}`
                      : "No Identity"}
                  </span>
                  {hasProfile && tier.label && (
                    <Badge variant={tier.variant} size="xs">
                      {tier.label}
                    </Badge>
                  )}
                </div>
                <div className="font-mono text-[11px] tracking-wider text-muted-foreground">
                  {short(address!)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50" />

        {/* Content: Action or Stats */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2.5">
            <StatSkeleton />
            <StatSkeleton />
          </div>
        ) : !hasProfile ? (
          <div className="space-y-3">
            <p className="text-center text-xs text-muted-foreground">
              Create an on-chain identity to start building reputation.
            </p>
            <Button
              className="w-full"
              size="lg"
              loading={tx.busy}
              onClick={createProfile}
            >
              <Icon
                icon="solar:user-plus-bold-duotone"
                className="mr-2 size-4"
              />
              Create Profile
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              icon="solar:check-circle-bold-duotone"
              color="text-emerald-500"
              bgColor="bg-emerald-500/10"
              label="Completed"
              value={completed.toString()}
            />
            <StatCard
              icon="solar:wallet-money-bold-duotone"
              color="text-blue-500"
              bgColor="bg-blue-500/10"
              label="Earned"
              value={`$${formatVolume(volume)}`}
              sublabel="USDC"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Stat Card ─────────────────────────────────────────────

function StatCard({
  icon,
  color,
  bgColor,
  label,
  value,
  sublabel,
}: {
  icon: string;
  color: string;
  bgColor: string;
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-background p-3.5 transition-all duration-200 hover:border-border hover:shadow-sm">
      <div className={`mb-2.5 flex size-9 items-center justify-center rounded-lg ${bgColor}`}>
        <Icon icon={icon} className={`size-[18px] ${color}`} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="truncate text-[15px] font-semibold tracking-tight">
          {value}
        </span>
        {sublabel && (
          <span className="text-[10px] font-medium text-muted-foreground">
            {sublabel}
          </span>
        )}
      </div>
      <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-background p-3.5">
      <div className="mb-2.5 h-9 animate-pulse rounded-lg bg-muted/80" />
      <div className="h-[15px] w-16 animate-pulse rounded bg-muted" />
      <div className="mt-1.5 h-3 w-12 animate-pulse rounded bg-muted" />
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function getTier(completed: number) {
  if (completed >= 50)
    return {
      label: "Legend",
      variant: "warning" as const,
      icon: "solar:crown-bold-duotone",
      color: "text-amber-500",
    };
  if (completed >= 25)
    return {
      label: "Expert",
      variant: "violet" as const,
      icon: "solar:star-bold-duotone",
      color: "text-violet-500",
    };
  if (completed >= 10)
    return {
      label: "Pro",
      variant: "info" as const,
      icon: "solar:shield-check-bold-duotone",
      color: "text-blue-500",
    };
  if (completed >= 1)
    return {
      label: "Verified",
      variant: "success" as const,
      icon: "solar:verified-check-bold-duotone",
      color: "text-emerald-500",
    };
  return {
    label: null,
    variant: "subtle" as const,
    icon: null,
    color: "",
  };
}

function formatVolume(value: string): string {
  const num = Number(value);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num < 0.01 ? "<0.01" : num.toFixed(2);
}