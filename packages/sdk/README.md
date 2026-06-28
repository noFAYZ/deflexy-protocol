# @deflexy/sdk

TypeScript (viem) SDK for the Deflexy Protocol. Framework-agnostic: typed
on-chain reads, transaction builders for every action, and Ponder indexer query
helpers. Works in Node, scripts, or any frontend.

## Install

```bash
pnpm add @deflexy/sdk viem
```

## Usage

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { createDeflexy, AgreementStatus, Capability } from "@deflexy/sdk";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const walletClient = createWalletClient({
  account: privateKeyToAccount("0x..."),
  chain: baseSepolia,
  transport: http(),
});

const deflexy = createDeflexy({
  publicClient,
  walletClient,                       // omit for read-only
  indexerUrl: "http://localhost:42069", // omit if not using query.*
});

// Reads (typed from the ABI)
const agreement = await deflexy.read.getAgreement(3n);
console.log(AgreementStatus[agreement.status]); // "Completed"

// Writes (return a tx hash)
const profileId = await deflexy.read.profileOf(walletClient.account.address);
const jobTx = await deflexy.write.createJob(profileId, usdc, 5_000_000n, 0 /*Fixed*/, cid);

// Fund escrow (approve then deposit)
await deflexy.write.approveToken(usdc, 5_000_000n);
await deflexy.write.fundVault(agreementId, 5_000_000n);

// Delegation
await deflexy.write.grantPermission(profileId, agency, Capability.CreateJob | Capability.AcceptBid, 0n);

// Indexer queries (Ponder GraphQL)
const mine = await deflexy.query.agreementsByFreelancer(profileId);
```

Defaults to the Base Sepolia deployment (`baseSepoliaAddresses`). Pass `addresses`
to target another deployment. `read` works with only a `publicClient`; `write`
requires a `walletClient` with an account.
