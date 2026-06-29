// Thin GraphQL client for the Ponder indexer. Returns plain JSON; bigint-typed
// fields come back as strings (GraphQL BigInt scalar) — convert at the edge.

export interface QueryClient {
  raw: <T = unknown>(query: string, variables?: Record<string, unknown>) => Promise<T>;
  openJobs: () => Promise<unknown>;
  allJobs: (limit?: number) => Promise<unknown>;
  agreementsByFreelancer: (profileId: bigint) => Promise<unknown>;
  agreementsByEmployer: (profileId: bigint) => Promise<unknown>;
  reputation: (profileId: bigint) => Promise<unknown>;
  paymentsForVault: (vaultId: bigint) => Promise<unknown>;
  /** Protocol-wide counts + escrow totals + top freelancers, for dashboards. */
  protocolStats: () => Promise<ProtocolStats>;
}

export interface ProtocolStats {
  profiles: number;
  jobs: number;
  openJobs: number;
  agreements: number;
  activeAgreements: number;
  completedAgreements: number;
  disputes: number;
  totalDeposited: bigint;
  totalReleased: bigint;
  totalRefunded: bigint;
  totalFees: bigint;
  topFreelancers: { profileId: string; completed: string; volume: string }[];
}

export function createQuery(indexerUrl?: string): QueryClient {
  const endpoint = indexerUrl ? `${indexerUrl.replace(/\/$/, "")}/graphql` : undefined;

  async function raw<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    if (!endpoint) throw new Error("Deflexy: indexerUrl is required for query methods");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const json = (await res.json()) as { data?: T; errors?: unknown };
    if (json.errors) throw new Error(`Deflexy indexer error: ${JSON.stringify(json.errors)}`);
    return json.data as T;
  }

  return {
    raw,
    openJobs: () =>
      raw(`{ jobs(where: { status: 1 }) { items { id employerProfileId budget paymentToken model metadataCID } } }`),
    allJobs: (limit = 50) =>
      raw(
        `query($n: Int!) { jobs(orderBy: "id", orderDirection: "desc", limit: $n) { items { id employerProfileId budget paymentToken model status metadataCID createdAt agreementId } } }`,
        { n: limit },
      ),
    agreementsByFreelancer: (profileId) =>
      raw(`query($id: BigInt!) { agreements(where: { freelancerProfileId: $id }) { items { id status totalAmount model jobId vaultId } } }`, {
        id: profileId.toString(),
      }),
    agreementsByEmployer: (profileId) =>
      raw(`query($id: BigInt!) { agreements(where: { employerProfileId: $id }) { items { id status totalAmount model jobId vaultId } } }`, {
        id: profileId.toString(),
      }),
    reputation: (profileId) =>
      raw(
        `query($id: BigInt!) { reputation(id: $id) { completedAsFreelancer completedAsEmployer volumeAsFreelancer disputesAsFreelancer disputesLostAsFreelancer disputesAsEmployer disputesLostAsEmployer } }`,
        { id: profileId.toString() },
      ),
    paymentsForVault: (vaultId) =>
      raw(`query($id: BigInt!) { payments(where: { vaultId: $id }) { items { id kind account amount txHash blockNumber } } }`, {
        id: vaultId.toString(),
      }),

    protocolStats: async (): Promise<ProtocolStats> => {
      const d = await raw<{
        profiles: { totalCount: number };
        jobs: { totalCount: number };
        openJobs: { totalCount: number };
        agreements: { totalCount: number };
        activeAgreements: { totalCount: number };
        completedAgreements: { totalCount: number };
        disputes: { totalCount: number };
        payments: { items: { kind: string; amount: string }[] };
        reputations: { items: { id: string; completedAsFreelancer: string; volumeAsFreelancer: string }[] };
      }>(`{
        profiles { totalCount }
        jobs { totalCount }
        openJobs: jobs(where: { status: 1 }) { totalCount }
        agreements { totalCount }
        activeAgreements: agreements(where: { status: 1 }) { totalCount }
        completedAgreements: agreements(where: { status: 4 }) { totalCount }
        disputes { totalCount }
        payments(limit: 1000) { items { kind amount } }
        reputations(orderBy: "volumeAsFreelancer", orderDirection: "desc", limit: 5) {
          items { id completedAsFreelancer volumeAsFreelancer }
        }
      }`);

      const sum = (kind: string) =>
        d.payments.items.filter((p) => p.kind === kind).reduce((acc, p) => acc + BigInt(p.amount), 0n);

      return {
        profiles: d.profiles.totalCount,
        jobs: d.jobs.totalCount,
        openJobs: d.openJobs.totalCount,
        agreements: d.agreements.totalCount,
        activeAgreements: d.activeAgreements.totalCount,
        completedAgreements: d.completedAgreements.totalCount,
        disputes: d.disputes.totalCount,
        totalDeposited: sum("deposit"),
        totalReleased: sum("release"),
        totalRefunded: sum("refund"),
        totalFees: sum("fee"),
        topFreelancers: d.reputations.items.map((r) => ({
          profileId: r.id,
          completed: r.completedAsFreelancer,
          volume: r.volumeAsFreelancer,
        })),
      };
    },
  };
}
