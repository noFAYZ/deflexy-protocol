# Deflexy Protocol

Decentralized freelancing protocol — on-chain agreements, escrow, and reputation.

- **Specs:** `docs/` (PRD, protocol, architecture) and `docs/contracts/` (per-module).
  Security amendments baked into the contracts are in
  [`docs/contracts/13-security-hardening.md`](docs/contracts/13-security-hardening.md).
- **Contracts:** `src/` — Foundry project (OpenZeppelin, fetched into `lib/`).
- **Indexer:** `packages/indexer/` — Ponder app indexing the protocol events.
- **SDK:** `packages/sdk/` — TypeScript/viem SDK ([README](packages/sdk/README.md)).
- **Web app:** `packages/web/` — React + wagmi dApp (connect wallet, create jobs).
- **Live deployment:** Base Sepolia — [`deployments/base-sepolia.md`](deployments/base-sepolia.md).

This is a pnpm workspace; the contracts live at the root and the TS packages
under `packages/`. `pnpm install` then build individual packages.

## Build & test

Requires [Foundry](https://book.getfoundry.sh/getting-started/installation).
Dependencies (OpenZeppelin, forge-std) live in `lib/` and are not committed.

```bash
forge install openzeppelin/openzeppelin-contracts   # fetch lib/ on a fresh clone
forge build
forge test
```

## Deploy

`script/Deploy.s.sol` deploys and wires the full protocol (core + extensions +
discovery registry). Configure via env: `PRIVATE_KEY`, `PROTOCOL_OWNER`,
`PAYMENT_TOKEN` (all optional).

```bash
forge script script/Deploy.s.sol --rpc-url <RPC> --broadcast
```

## Run the app

```bash
pnpm install
# 1) indexer (serves GraphQL on :42069)
pnpm --filter @deflexy/indexer exec ponder codegen
DATABASE_SCHEMA=deflexy pnpm --filter @deflexy/indexer exec ponder start
# 2) build the SDK, then start the web app (:5173)
pnpm --filter @deflexy/sdk build
pnpm --filter @deflexy/web dev
```

Open http://localhost:5173, connect a wallet on Base Sepolia, create a profile,
and post a job. The job list reads from the indexer; writes go through the SDK.

## Deploy the web app (Vercel)

Builds the SDK + web bundle locally and pushes the prebuilt `dist/` to Vercel
(no monorepo build runs on Vercel). Requires a logged-in Vercel CLI
(`npx vercel login`).

```bash
pnpm deploy:web
```

## Status

Core protocol + extensions (FeeManager, DisputeManager, PermissionManager)
implemented with the v1.0.1 security hardening applied — token allowlist &
balance-delta deposits, set-once trusted wiring, funding-before-work, allocation
bound, dispute lock, approval timeout, pull payments, and a scoped guardian
circuit breaker. See `docs/contracts/13-security-hardening.md`.

17 tests pass (`forge test`), including a fee-math fuzz, a vault-accounting
fuzz, and a handler-driven **solvency invariant** (the VaultManager always holds
exactly what it owes).

Uses OpenZeppelin (Ownable, SafeERC20, ReentrancyGuard) as the audited trust
base. Deployed + verified on Base Sepolia and exercised end-to-end with real
USDC (fixed, milestone, revision, dispute/split). Indexer and SDK built and
verified against the live deployment.

Not yet done: external security audit, gas-snapshot tuning, optional React hooks
layer for the SDK.
