import {
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Transport,
  erc20Abi,
} from "viem";
import { baseSepoliaAddresses, type DeflexyAddresses } from "./addresses";
import {
  ProfileRegistryAbi,
  JobRegistryAbi,
  BidRegistryAbi,
  AgreementRegistryAbi,
  VaultManagerAbi,
  WorkUnitManagerAbi,
  DisputeManagerAbi,
  FeeManagerAbi,
  PermissionManagerAbi,
} from "./abis";
import { createQuery } from "./query";

export interface DeflexyConfig {
  // chain generic widened to `any` so OP-stack chains (Base) and others all fit;
  // read return types are inferred from the ABI, so they stay fully typed.
  publicClient: PublicClient<Transport, any>;
  /** Required only for write methods. */
  walletClient?: WalletClient<Transport, any, any>;
  /** Defaults to the Base Sepolia deployment. */
  addresses?: DeflexyAddresses;
  /** Ponder indexer base URL, e.g. http://localhost:42069 — enables `query.*`. */
  indexerUrl?: string;
}

export function createDeflexy(config: DeflexyConfig) {
  const addr = config.addresses ?? baseSepoliaAddresses;
  const pub = config.publicClient;

  const requireWallet = (): WalletClient => {
    if (!config.walletClient) throw new Error("Deflexy: walletClient is required for write methods");
    return config.walletClient;
  };

  // ponytail: the abi is `any` inside this wrapper to avoid threading viem's
  // heavy write generics through every call; the public methods below are fully
  // typed, so callers keep autocomplete + arg checking.
  const send = (address: Address, abi: unknown, functionName: string, args: unknown[]): Promise<Hash> => {
    const w = requireWallet();
    if (!w.account) throw new Error("Deflexy: walletClient.account is required");
    return (w.writeContract as (a: unknown) => Promise<Hash>)({
      address,
      abi,
      functionName,
      args,
      account: w.account,
      chain: w.chain,
    });
  };

  const read = {
    profileOf: (owner: Address) =>
      pub.readContract({ address: addr.profileRegistry, abi: ProfileRegistryAbi, functionName: "profileOf", args: [owner] }),
    getProfile: (id: bigint) =>
      pub.readContract({ address: addr.profileRegistry, abi: ProfileRegistryAbi, functionName: "getProfile", args: [id] }),
    getJob: (id: bigint) =>
      pub.readContract({ address: addr.jobRegistry, abi: JobRegistryAbi, functionName: "getJob", args: [id] }),
    jobCount: () =>
      pub.readContract({ address: addr.jobRegistry, abi: JobRegistryAbi, functionName: "jobCount" }),
    /** Reads the newest `limit` jobs straight from chain (always current; no indexer). */
    listJobs: async (limit = 25) => {
      const count = Number(
        await pub.readContract({ address: addr.jobRegistry, abi: JobRegistryAbi, functionName: "jobCount" }),
      );
      const ids = Array.from({ length: Math.min(count, limit) }, (_, i) => BigInt(count - i));
      const rows = await Promise.all(
        ids.map((id) =>
          pub
            .readContract({ address: addr.jobRegistry, abi: JobRegistryAbi, functionName: "getJob", args: [id] })
            .then((job) => ({ id, ...job }))
            .catch(() => null),
        ),
      );
      return rows.filter((r): r is NonNullable<typeof r> => r !== null);
    },
    getBid: (id: bigint) =>
      pub.readContract({ address: addr.bidRegistry, abi: BidRegistryAbi, functionName: "getBid", args: [id] }),
    ownerOf: (profileId: bigint) =>
      pub.readContract({ address: addr.profileRegistry, abi: ProfileRegistryAbi, functionName: "ownerOf", args: [profileId] }),
    /** All bids (optionally for one job), newest-first, read from chain. */
    listBids: async (jobId?: bigint, limit = 100) => {
      const count = Number(
        await pub.readContract({ address: addr.bidRegistry, abi: BidRegistryAbi, functionName: "bidCount" }),
      );
      const ids = Array.from({ length: Math.min(count, limit) }, (_, i) => BigInt(count - i));
      const rows = await Promise.all(
        ids.map((id) =>
          pub
            .readContract({ address: addr.bidRegistry, abi: BidRegistryAbi, functionName: "getBid", args: [id] })
            .then((bid) => ({ id, ...bid }))
            .catch(() => null),
        ),
      );
      const bids = rows.filter((r): r is NonNullable<typeof r> => r !== null);
      return jobId === undefined ? bids : bids.filter((b) => b.jobId === jobId);
    },
    /** Work units for an agreement, ordered by sequence, read from chain. */
    listWorkUnits: async (agreementId: bigint, limit = 100) => {
      const count = Number(
        await pub.readContract({ address: addr.workUnitManager, abi: WorkUnitManagerAbi, functionName: "workUnitCount" }),
      );
      const ids = Array.from({ length: Math.min(count, limit) }, (_, i) => BigInt(count - i));
      const rows = await Promise.all(
        ids.map((id) =>
          pub
            .readContract({ address: addr.workUnitManager, abi: WorkUnitManagerAbi, functionName: "getWorkUnit", args: [id] })
            .then((wu) => ({ id, ...wu }))
            .catch(() => null),
        ),
      );
      return rows
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .filter((w) => w.agreementId === agreementId)
        .sort((a, b) => Number(a.sequence - b.sequence));
    },
    /** The agreement bound to a job (or null), read from chain. */
    agreementForJob: async (jobId: bigint) => {
      const aid = await pub.readContract({
        address: addr.agreementRegistry,
        abi: AgreementRegistryAbi,
        functionName: "agreementOfJob",
        args: [jobId],
      });
      if (aid === 0n) return null;
      const a = await pub.readContract({
        address: addr.agreementRegistry,
        abi: AgreementRegistryAbi,
        functionName: "getAgreement",
        args: [aid],
      });
      return { id: aid, ...a };
    },
    getAgreement: (id: bigint) =>
      pub.readContract({ address: addr.agreementRegistry, abi: AgreementRegistryAbi, functionName: "getAgreement", args: [id] }),
    getWorkUnit: (id: bigint) =>
      pub.readContract({ address: addr.workUnitManager, abi: WorkUnitManagerAbi, functionName: "getWorkUnit", args: [id] }),
    getVault: (id: bigint) =>
      pub.readContract({ address: addr.vaultManager, abi: VaultManagerAbi, functionName: "getVault", args: [id] }),
    vaultAvailable: (id: bigint) =>
      pub.readContract({ address: addr.vaultManager, abi: VaultManagerAbi, functionName: "available", args: [id] }),
    claimable: (recipient: Address, token: Address) =>
      pub.readContract({ address: addr.vaultManager, abi: VaultManagerAbi, functionName: "claimable", args: [recipient, token] }),
    /** ERC-20 allowance from `owner` to the VaultManager (to skip redundant approvals). */
    allowance: (token: Address, owner: Address) =>
      pub.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, addr.vaultManager] }),
    getDispute: (id: bigint) =>
      pub.readContract({ address: addr.disputeManager, abi: DisputeManagerAbi, functionName: "getDispute", args: [id] }),
    /** The current open dispute for an agreement (or null), read from chain. */
    disputeForAgreement: async (agreementId: bigint) => {
      const id = await pub.readContract({
        address: addr.disputeManager,
        abi: DisputeManagerAbi,
        functionName: "openDisputeOf",
        args: [agreementId],
      });
      if (id === 0n) return null;
      const d = await pub.readContract({
        address: addr.disputeManager,
        abi: DisputeManagerAbi,
        functionName: "getDispute",
        args: [id],
      });
      return { id, ...d };
    },
    feeQuote: (token: Address, amount: bigint) =>
      pub.readContract({ address: addr.feeManager, abi: FeeManagerAbi, functionName: "quote", args: [token, amount] }),
    hasPermission: (profileId: bigint, account: Address, capability: bigint) =>
      pub.readContract({ address: addr.permissionManager, abi: PermissionManagerAbi, functionName: "hasPermission", args: [profileId, account, capability] }),
    /** The current grant (mask + expiration) for a delegate on a profile; mask 0 = none. */
    getGrant: (profileId: bigint, delegate: Address) =>
      pub.readContract({ address: addr.permissionManager, abi: PermissionManagerAbi, functionName: "getGrant", args: [profileId, delegate] }),
  };

  const write = {
    createProfile: (metadataCID: Hex) => send(addr.profileRegistry, ProfileRegistryAbi, "createProfile", [metadataCID]),
    updateMetadata: (profileId: bigint, metadataCID: Hex) => send(addr.profileRegistry, ProfileRegistryAbi, "updateMetadata", [profileId, metadataCID]),

    createJob: (employerProfileId: bigint, token: Address, budget: bigint, model: number, metadataCID: Hex) =>
      send(addr.jobRegistry, JobRegistryAbi, "createJob", [employerProfileId, token, budget, model, metadataCID]),
    cancelJob: (jobId: bigint) => send(addr.jobRegistry, JobRegistryAbi, "cancelJob", [jobId]),

    submitBid: (jobId: bigint, freelancerProfileId: bigint, amount: bigint, estimatedDuration: bigint, proposalCID: Hex) =>
      send(addr.bidRegistry, BidRegistryAbi, "submitBid", [jobId, freelancerProfileId, amount, estimatedDuration, proposalCID]),
    withdrawBid: (bidId: bigint) => send(addr.bidRegistry, BidRegistryAbi, "withdrawBid", [bidId]),

    createAgreement: (jobId: bigint, bidId: bigint) => send(addr.agreementRegistry, AgreementRegistryAbi, "createAgreement", [jobId, bidId]),
    /** ERC-20 approve to the VaultManager (call before fundVault). */
    approveToken: (token: Address, amount: bigint) => send(token, erc20Abi, "approve", [addr.vaultManager, amount]),
    fundVault: (agreementId: bigint, amount: bigint) => send(addr.agreementRegistry, AgreementRegistryAbi, "fundVault", [agreementId, amount]),
    addWorkUnit: (agreementId: bigint, sequence: bigint, amount: bigint, metadataCID: Hex) =>
      send(addr.agreementRegistry, AgreementRegistryAbi, "addWorkUnit", [agreementId, sequence, amount, metadataCID]),
    startWork: (workUnitId: bigint) => send(addr.agreementRegistry, AgreementRegistryAbi, "startWork", [workUnitId]),
    submitWork: (workUnitId: bigint, submissionCID: Hex) => send(addr.agreementRegistry, AgreementRegistryAbi, "submitWork", [workUnitId, submissionCID]),
    requestRevision: (workUnitId: bigint) => send(addr.agreementRegistry, AgreementRegistryAbi, "requestRevision", [workUnitId]),
    approveWork: (workUnitId: bigint) => send(addr.agreementRegistry, AgreementRegistryAbi, "approveWork", [workUnitId]),
    claimApproval: (workUnitId: bigint) => send(addr.agreementRegistry, AgreementRegistryAbi, "claimApproval", [workUnitId]),
    settleWorkUnit: (workUnitId: bigint) => send(addr.agreementRegistry, AgreementRegistryAbi, "settleWorkUnit", [workUnitId]),
    completeAgreement: (agreementId: bigint) => send(addr.agreementRegistry, AgreementRegistryAbi, "completeAgreement", [agreementId]),
    terminateAgreement: (agreementId: bigint) => send(addr.agreementRegistry, AgreementRegistryAbi, "terminateAgreement", [agreementId]),

    /** Pull an accrued claimable balance (release/refund) for the caller. */
    withdraw: (token: Address) => send(addr.vaultManager, VaultManagerAbi, "withdraw", [token]),

    openDispute: (agreementId: bigint, evidenceCID: Hex) => send(addr.disputeManager, DisputeManagerAbi, "openDispute", [agreementId, evidenceCID]),
    submitEvidence: (disputeId: bigint, evidenceCID: Hex) => send(addr.disputeManager, DisputeManagerAbi, "submitEvidence", [disputeId, evidenceCID]),

    grantPermission: (profileId: bigint, delegate: Address, mask: bigint, expiration: bigint) =>
      send(addr.permissionManager, PermissionManagerAbi, "grantPermission", [profileId, delegate, mask, expiration]),
    revokePermission: (profileId: bigint, delegate: Address) =>
      send(addr.permissionManager, PermissionManagerAbi, "revokePermission", [profileId, delegate]),
  };

  return { addresses: addr, read, write, query: createQuery(config.indexerUrl) };
}

export type DeflexyClient = ReturnType<typeof createDeflexy>;
