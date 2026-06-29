import { useEffect, useState, useSyncExternalStore } from "react";
import { encodeFunctionData, type Abi, type Address, type Hash, type Hex } from "viem";
import { useAccount, usePublicClient, useSignMessage, useWalletClient } from "wagmi";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { sileo } from "sileo";
import { useDeflexy } from "@/deflexy";
import {
  accessLink,
  fetchAttachment,
  fetchBrief,
  fetchProfileMeta,
  isEmptyCid,
  setSigner,
  type ImgOpts,
} from "@/lib/ipfs";

/** Registers the connected wallet so the IPFS helpers can mint a session on demand. */
export function useRegisterSigner() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  useEffect(() => {
    setSigner(address ? { address, signMessageAsync } : null);
  }, [address, signMessageAsync]);
}

/** Public name/bio for a profile (reads its on-chain metadataCID, then the envelope). */
export function useProfileMeta(profileId?: bigint) {
  const deflexy = useDeflexy();
  const { isConnected } = useAccount();
  return useQuery({
    queryKey: ["profileMeta", profileId?.toString()],
    enabled: !!deflexy && isConnected && !!profileId && profileId !== 0n,
    staleTime: 60_000,
    queryFn: async () => {
      const p = (await deflexy!.read.getProfile(profileId!)) as { metadataCID: Hex };
      return fetchProfileMeta(p.metadataCID);
    },
  });
}

export interface EmployerStats {
  posted: number; // jobs posted
  hires: number; // agreements entered as employer
  completed: number; // agreements completed (status 4)
  escrow: bigint; // total escrow committed across agreements (token base units)
  paymentVerified: boolean;
}

/** Employer trust analytics derived from the indexer (one batched GraphQL query). */
export function useEmployerStats(profileId?: bigint) {
  const deflexy = useDeflexy();
  return useQuery({
    queryKey: ["employerStats", profileId?.toString()],
    enabled: !!deflexy && !!profileId && profileId !== 0n,
    staleTime: 60_000,
    queryFn: async (): Promise<EmployerStats> => {
      const d = await deflexy!.query.raw<{
        posted: { totalCount: number };
        hires: { totalCount: number; items: { totalAmount: string }[] };
        completed: { totalCount: number };
      }>(
        `query($id: BigInt!) {
          posted: jobs(where: { employerProfileId: $id }) { totalCount }
          hires: agreements(where: { employerProfileId: $id }, limit: 1000) { totalCount items { totalAmount } }
          completed: agreements(where: { employerProfileId: $id, status: 4 }) { totalCount }
        }`,
        { id: profileId!.toString() },
      );
      const escrow = d.hires.items.reduce((a, x) => a + BigInt(x.totalAmount), 0n);
      return {
        posted: d.posted.totalCount,
        hires: d.hires.totalCount,
        completed: d.completed.totalCount,
        escrow,
        paymentVerified: escrow > 0n || d.completed.totalCount > 0,
      };
    },
  });
}

/** Fetches a private brief envelope for a job's metadata ref (requires a connected wallet).
 * Content-addressed ⇒ immutable, so it's cached indefinitely and never refetched. */
export function useBrief(ref?: Hex | null) {
  const { isConnected } = useAccount();
  return useQuery({
    queryKey: ["brief", ref],
    enabled: isConnected && !isEmptyCid(ref),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1, // a 404 (not pinned) won't resolve by retrying
    queryFn: () => fetchBrief(ref),
  });
}

/** Reads an attachment envelope (proposal/deliverable) — pass a null ref to skip the fetch,
 * which is how we avoid pulling proposals the viewer isn't allowed to see. */
export function useAttachment(ref?: Hex | null) {
  const { isConnected } = useAccount();
  return useQuery({
    queryKey: ["attachment", ref],
    enabled: isConnected && !isEmptyCid(ref),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: () => fetchAttachment(ref),
  });
}

/** Signed access URL for a private ref (optionally an optimized thumbnail). The URL is
 * ephemeral (expires ~120s server-side), so we deliberately keep the window short. */
export function useAccessLink(ref?: Hex | null, img?: ImgOpts) {
  const { isConnected } = useAccount();
  return useQuery({
    queryKey: ["accessLink", ref, img?.width, img?.height],
    enabled: isConnected && !isEmptyCid(ref),
    staleTime: 90_000,
    gcTime: 90_000,
    queryFn: () => accessLink(ref!, img),
  });
}

export interface Call {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}

// Global write-activity counter → drives the top pending bar so there's always feedback.
let pending = 0;
const pendingListeners = new Set<() => void>();
function bumpPending(delta: number) {
  pending += delta;
  pendingListeners.forEach((l) => l());
}
export function useGlobalPending() {
  return useSyncExternalStore(
    (cb) => {
      pendingListeners.add(cb);
      return () => pendingListeners.delete(cb);
    },
    () => pending > 0,
    () => false,
  );
}

const userRejected = (e: unknown) => {
  const err = e as { code?: number; message?: string; shortMessage?: string };
  return err.code === 4001 || /rejected|denied/i.test(`${err.shortMessage ?? ""} ${err.message ?? ""}`);
};

/** Sileo loading → success/error toast config for a labelled transaction. */
const toastOpts = (label: string) => ({
  loading: { title: `${label} pending…` },
  success: { title: `${label} confirmed` },
  error: (err: unknown) => ({
    title: "Something went wrong",
    description: userRejected(err) ? "Rejected in wallet" : `${label} failed`,
  }),
});

/** Fire a Sileo toast around a slow upload (Pinata pin) so the user sees the
 * upload phase before the transaction toast. Returns the original promise so the
 * caller still gets the value (and its rejection). */
export function withUploadToast<T>(p: Promise<T>, title = "Uploading…"): Promise<T> {
  sileo.promise(p, {
    loading: { title },
    success: { title: "Stored privately" },
    error: () => ({ title: "Upload failed" }),
  });
  return p;
}

/** The connected wallet's protocol profile id (0n if none). */
export function useProfileId() {
  const { address } = useAccount();
  const deflexy = useDeflexy();
  return useQuery({
    queryKey: ["profile", address],
    enabled: !!deflexy && !!address,
    queryFn: () => deflexy!.read.profileOf(address!),
  });
}

/** Wraps a write: send → wait for receipt → invalidate, with a Sileo toast + busy state. */
export function useTx() {
  const publicClient = usePublicClient();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(fn: () => Promise<Hash>, invalidate: QueryKey[] = [], label = "Transaction") {
    if (!publicClient) return false;
    setBusy(true);
    setError("");
    bumpPending(1);
    try {
      await sileo.promise(
        (async () => {
          const hash = await fn();
          await publicClient.waitForTransactionReceipt({ hash });
          for (const key of invalidate) qc.invalidateQueries({ queryKey: key });
        })(),
        toastOpts(label),
      );
      return true;
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setError(err.shortMessage ?? err.message ?? "Transaction failed");
      return false;
    } finally {
      setBusy(false);
      bumpPending(-1);
    }
  }

  return { run, busy, error, setError };
}

/**
 * Sends one-or-more calls as a single wallet confirmation via EIP-5792
 * (`wallet_sendCalls`) when supported, falling back to sequential txs. Shows the
 * same Sileo loading → confirmed/failed toast.
 */
export function useBatchTx() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sequential(calls: Call[]) {
    for (const c of calls) {
      const hash = await (walletClient as NonNullable<typeof walletClient>).writeContract({
        address: c.address,
        abi: c.abi,
        functionName: c.functionName,
        args: c.args,
        account: walletClient!.account,
        chain: walletClient!.chain,
      } as never);
      await publicClient!.waitForTransactionReceipt({ hash });
    }
  }

  async function run(calls: Call[], invalidate: QueryKey[] = [], label = "Transaction") {
    if (!walletClient || !publicClient || calls.length === 0) return false;
    setBusy(true);
    setError("");
    bumpPending(1);
    try {
      await sileo.promise(
        (async () => {
          if (calls.length > 1) {
            try {
              const { id } = await walletClient.sendCalls({
                calls: calls.map((c) => ({
                  to: c.address,
                  data: encodeFunctionData({ abi: c.abi, functionName: c.functionName, args: c.args } as never),
                })),
              });
              await walletClient.waitForCallsStatus({ id });
            } catch (e) {
              if (userRejected(e)) throw e; // don't re-prompt sequentially
              await sequential(calls); // wallet lacks EIP-5792 → sequential
            }
          } else {
            await sequential(calls);
          }
          for (const k of invalidate) qc.invalidateQueries({ queryKey: k });
        })(),
        toastOpts(label),
      );
      return true;
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setError(err.shortMessage ?? err.message ?? "Transaction failed");
      return false;
    } finally {
      setBusy(false);
      bumpPending(-1);
    }
  }

  return { run, busy, error };
}
