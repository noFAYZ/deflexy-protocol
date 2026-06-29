// Central service endpoints (env-aware) + reachability checks. Shared by the IPFS
// helpers — so a dead backend never prompts a wallet signature — and the /status page.
// In production set VITE_API_URL / VITE_INDEXER_URL / VITE_RPC_URL; the localhost
// defaults are dev-only (a deployed build left on these is what triggers the CORS errors).

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8787";
export const INDEXER_URL = (import.meta.env.VITE_INDEXER_URL as string | undefined) ?? "http://localhost:42069";
export const RPC_URL =
  (import.meta.env.VITE_RPC_URL as string | undefined) ??
  "https://lb.drpc.live/base-sepolia/AkEyyu6_xUrOhzaU1tASz7U66_jUcjwR8aL_VjewFaCJ";

/** True if the URL answers a 2xx within `timeout` ms; never throws. */
export async function ping(url: string, init?: RequestInit, timeout = 5000): Promise<boolean> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
    return res.ok;
  } catch {
    return false;
  }
}

export const checkApi = () => ping(`${API_URL}/health`);
export const checkIndexer = () => ping(`${INDEXER_URL}/health`); // Ponder serves /health
export const checkRpc = () =>
  ping(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId" }),
  });

export const SERVICES = [
  { name: "API (backend)", url: API_URL, check: checkApi },
  { name: "Indexer (Ponder)", url: INDEXER_URL, check: checkIndexer },
  { name: "RPC (Base Sepolia)", url: '', check: checkRpc },
] as const;
