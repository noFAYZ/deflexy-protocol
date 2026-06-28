import { useMemo } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { createDeflexy, type DeflexyClient } from "@deflexy/sdk";
import { INDEXER_URL } from "@/lib/health";

/** Ponder indexer GraphQL endpoint (set VITE_INDEXER_URL; defaults to localhost dev). */
export { INDEXER_URL };

/** Base Sepolia test USDC (6 decimals), allowlisted in the VaultManager. */
export const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

export function useDeflexy(): DeflexyClient | null {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    if (!publicClient) return null;
    return createDeflexy({
      publicClient,
      walletClient: walletClient ?? undefined,
      indexerUrl: INDEXER_URL,
    });
  }, [publicClient, walletClient]);
}
