import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { ProfileName } from "@/components/ProfileName";
import { useDeflexy } from "@/deflexy";

const usdc = (v: bigint) => `${Number(formatUnits(v, 6)).toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`;

interface Rep {
  id: string;
  completedAsFreelancer: string;
  completedAsEmployer: string;
  volumeAsFreelancer: string;
  disputesAsFreelancer: string;
  disputesLostAsFreelancer: string;
}

/** Browse profiles ranked by reputation (indexer). Surfaces the whole directory, not just
 * the analytics top-5. */
export function Directory() {
  const deflexy = useDeflexy();
  const [q, setQ] = useState("");

  const { data, isError } = useQuery({
    queryKey: ["directory"],
    enabled: !!deflexy,
    retry: false,
    refetchInterval: 30000,
    queryFn: async () => {
      const d = await deflexy!.query.raw<{ reputations: { items: Rep[] } }>(
        `{ reputations(orderBy: "volumeAsFreelancer", orderDirection: "desc", limit: 100) {
            items { id completedAsFreelancer completedAsEmployer volumeAsFreelancer disputesAsFreelancer disputesLostAsFreelancer }
        } }`,
      );
      return d.reputations.items;
    },
  });

  const list = (data ?? []).filter((r) => !q || r.id.includes(q.replace(/^#/, "")));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Freelancers</h2>
        <p className="text-muted-foreground text-xs">Browse profiles by reputation and earnings</p>
      </div>

      <div className="bg-card flex items-center gap-2 rounded-xl border px-3 py-2 shadow-xs">
        <Icon icon="solar:magnifer-outline" className="text-muted-foreground size-4" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by profile id…"
          className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {isError ? (
        <Empty icon="solar:cloud-cross-outline" text="Indexer offline — directory unavailable." />
      ) : !data ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="bg-surface/60 h-14 animate-pulse rounded-xl" />)}</div>
      ) : list.length === 0 ? (
        <Empty icon="solar:users-group-rounded-outline" text="No profiles found." />
      ) : (
        <div className="border-border/60 bg-card divide-border/50 overflow-hidden rounded-xl border shadow-xs divide-y">
          {list.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-muted-foreground w-6 shrink-0 text-center font-mono text-xs">{i + 1}</span>
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-info))" }}
              >
                {r.id}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  <ProfileName profileId={BigInt(r.id)} prefix="Profile" />
                </div>
                <div className="text-muted-foreground text-xs">
                  {r.completedAsFreelancer} as freelancer · {r.completedAsEmployer} as client
                  {BigInt(r.disputesAsFreelancer) > 0n && (
                    <> · {r.disputesLostAsFreelancer}/{r.disputesAsFreelancer} disputes lost</>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="font-mono">{usdc(BigInt(r.volumeAsFreelancer))}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Empty = ({ icon, text }: { icon: string; text: string }) => (
  <div className="border-border/60 text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center text-sm">
    <Icon icon={icon} className="size-6 opacity-50" />
    {text}
  </div>
);
