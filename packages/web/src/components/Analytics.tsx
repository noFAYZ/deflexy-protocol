import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { ProfileName } from "@/components/ProfileName";
import { useDeflexy } from "@/deflexy";
import { BarRow, CHART, Donut, Legend, SegmentBar, type Segment } from "@/components/charts";

const compactUsd = (v: bigint) =>
  Number(formatUnits(v, 6)).toLocaleString(undefined, { maximumFractionDigits: 0, notation: "compact" });
const fullUsd = (v: bigint) => `${Number(formatUnits(v, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;

export function Analytics() {
  const deflexy = useDeflexy();
  const { data, error, isLoading } = useQuery({
    queryKey: ["stats"],
    enabled: !!deflexy,
    queryFn: () => deflexy!.query.protocolStats(),
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground text-xs">Live protocol activity on Base Sepolia</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface/60 h-24 animate-pulse rounded-2xl" />
            ))}
          </div>
          <div className="bg-surface/60 h-56 animate-pulse rounded-2xl" />
        </div>
      ) : error || !data ? (
        <div className="border-border/60 text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm">
          <Icon icon="hugeicons:analytics-up" className="size-6 opacity-50" />
          Indexer offline or still backfilling.
          <code className="bg-surface rounded px-1.5 py-0.5 text-xs">pnpm --filter @deflexy/indexer start</code>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon="solar:users-group-rounded-bold-duotone" label="Profiles" value={data.profiles} tone="primary" />
            <Kpi icon="solar:case-minimalistic-bold-duotone" label="Jobs posted" value={data.jobs} tone="info" />
            <Kpi icon="solar:document-text-bold-duotone" label="Agreements" value={data.agreements} tone="success" />
            <Kpi
              icon="solar:wallet-money-bold-duotone"
              label="Total escrowed"
              value={compactUsd(data.totalDeposited)}
              suffix="USDC"
              tone="warning"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* Agreement status donut */}
            <Panel title="Agreement status" icon="solar:pie-chart-2-bold-duotone">
              {(() => {
                const segs: Segment[] = [
                  { label: "Active", value: data.activeAgreements, color: CHART.info },
                  { label: "Completed", value: data.completedAgreements, color: CHART.success },
                  { label: "Disputed", value: data.disputes, color: CHART.destructive },
                ];
                const sum = segs.reduce((a, s) => a + s.value, 0);
                return (
                  <div className="flex items-center gap-5">
                    <Donut segments={segs} centerValue={data.agreements} centerLabel="total" />
                    {sum > 0 ? (
                      <Legend items={segs.map((s) => ({ label: s.label, value: s.value, color: s.color }))} />
                    ) : (
                      <p className="text-muted-foreground flex-1 text-sm">No agreements yet.</p>
                    )}
                  </div>
                );
              })()}
            </Panel>

            {/* Escrow flow */}
            <Panel title="Escrow flow" icon="solar:money-bag-bold-duotone">
              {(() => {
                const locked =
                  data.totalDeposited - data.totalReleased - data.totalRefunded - data.totalFees;
                const segs: Segment[] = [
                  { label: "Released", value: Number(data.totalReleased), color: CHART.success },
                  { label: "Refunded", value: Number(data.totalRefunded), color: CHART.warning },
                  { label: "Fees", value: Number(data.totalFees), color: CHART.info },
                  { label: "In escrow", value: Math.max(Number(locked), 0), color: CHART.primary },
                ];
                const has = segs.some((s) => s.value > 0);
                return (
                  <div className="space-y-3">
                    <div className="text-2xl font-bold tracking-tight">{fullUsd(data.totalDeposited)}</div>
                    {has ? (
                      <>
                        <SegmentBar segments={segs} />
                        <Legend
                          items={[
                            { label: "Released", value: compactUsd(data.totalReleased), color: CHART.success },
                            { label: "Refunded", value: compactUsd(data.totalRefunded), color: CHART.warning },
                            { label: "Fees", value: compactUsd(data.totalFees), color: CHART.info },
                            { label: "In escrow", value: compactUsd(locked > 0n ? locked : 0n), color: CHART.primary },
                          ]}
                        />
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm">No funds escrowed yet.</p>
                    )}
                  </div>
                );
              })()}
            </Panel>
          </div>

          {/* Job funnel */}
          <Panel title="Job funnel" icon="solar:filter-bold-duotone">
            <div className="space-y-3">
              <BarRow label="Posted" value={data.jobs} max={data.jobs} color={CHART.info} />
              <BarRow label="Open" value={data.openJobs} max={data.jobs} color={CHART.primary} />
              <BarRow label="Agreements" value={data.agreements} max={data.jobs} color={CHART.warning} />
              <BarRow label="Completed" value={data.completedAgreements} max={data.jobs} color={CHART.success} />
            </div>
          </Panel>

          {/* Top freelancers */}
          <Panel title="Top freelancers" icon="solar:ranking-bold-duotone">
            <TopFreelancers items={data.topFreelancers} />
          </Panel>
        </>
      )}
    </div>
  );
}

function TopFreelancers({ items }: { items: { profileId: string; completed: string; volume: string }[] }) {
  const ranked = items.filter((f) => f.completed !== "0");
  if (ranked.length === 0) return <p className="text-muted-foreground text-sm">No settled work yet.</p>;
  const max = Math.max(...ranked.map((f) => Number(f.volume)));
  return (
    <div className="space-y-3">
      {ranked.map((f, i) => (
        <BarRow
          key={f.profileId}
          label={
            <span className="inline-flex items-center gap-2">
              <Badge variant={i === 0 ? "warning" : "secondary"} size="xs">
                #{i + 1}
              </Badge>
              <ProfileName profileId={BigInt(f.profileId)} /> · {f.completed} done
            </span>
          }
          value={Number(f.volume)}
          display={`${compactUsd(BigInt(f.volume))} USDC`}
          max={max}
          color={CHART.primary}
        />
      ))}
    </div>
  );
}

const TONES: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
};

function Kpi({
  icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  suffix?: string;
  tone: keyof typeof TONES | string;
}) {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-2xl border p-4 shadow-xs">
      <div className={`flex size-9 items-center justify-center rounded-lg ${TONES[tone] ?? TONES.primary}`}>
        <Icon icon={icon} className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1">
          <span className="truncate text-2xl font-bold tracking-tight">{value}</span>
          {suffix && <span className="text-muted-foreground text-xs font-medium">{suffix}</span>}
        </div>
        <div className="text-muted-foreground text-xs">{label}</div>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="bg-card rounded-2xl border p-4 shadow-xs">
      <div className="mb-4 flex items-center gap-2">
        <Icon icon={icon} className="text-muted-foreground size-4" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}
