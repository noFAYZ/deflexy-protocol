import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { RPC_URL } from "@/lib/health";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  // Collapse contract reads into a single multicall, and batch JSON-RPC calls per tick —
  // turns dozens of eth_calls into one request, which is what was tripping the 429s.
  batch: { multicall: true },
  transports: {
    [baseSepolia.id]: http(RPC_URL, { batch: true }),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
