import { createConfig } from "ponder";

import { ProfileRegistryAbi } from "./abis/ProfileRegistry";
import { JobRegistryAbi } from "./abis/JobRegistry";
import { BidRegistryAbi } from "./abis/BidRegistry";
import { AgreementRegistryAbi } from "./abis/AgreementRegistry";
import { VaultManagerAbi } from "./abis/VaultManager";
import { WorkUnitManagerAbi } from "./abis/WorkUnitManager";
import { ReputationRegistryAbi } from "./abis/ReputationRegistry";
import { DisputeManagerAbi } from "./abis/DisputeManager";

const chain = "baseSepolia" as const;
const startBlock = 43_394_360; // just before the deployment txs

export default createConfig({
  chains: {
    baseSepolia: {
      id: 84532,
      rpc: process.env.PONDER_RPC_URL_84532 ?? "https://base-sepolia.drpc.org",
      // Public RPCs make Ponder throttle conservatively; drpc serves large
      // getLogs ranges, so lift the cap. For production use a dedicated RPC
      // (Alchemy/Infura) via PONDER_RPC_URL_84532.
      maxRequestsPerSecond: 40,
    },
  },
  contracts: {
    ProfileRegistry: {
      chain,
      abi: ProfileRegistryAbi,
      address: "0x354fb8da7d5475b17e4d5a234b0d697bff68a0dd",
      startBlock,
    },
    JobRegistry: {
      chain,
      abi: JobRegistryAbi,
      address: "0x3f5093e4ff021da840d8278ee3780a09b7bdb81f",
      startBlock,
    },
    BidRegistry: {
      chain,
      abi: BidRegistryAbi,
      address: "0x043dc3649c51245f8e085315cd7f7273f608565e",
      startBlock,
    },
    AgreementRegistry: {
      chain,
      abi: AgreementRegistryAbi,
      address: "0x81dF5CB950308a01C07240c7c4e267a0eE70DC70",
      startBlock,
    },
    VaultManager: {
      chain,
      abi: VaultManagerAbi,
      address: "0xa44B1B44bC4f0f5F5BB823E1540c1C14aC3aAD1e",
      startBlock,
    },
    WorkUnitManager: {
      chain,
      abi: WorkUnitManagerAbi,
      address: "0x0eea19241a6e6627304d708eb355bc81889479c2",
      startBlock,
    },
    ReputationRegistry: {
      chain,
      abi: ReputationRegistryAbi,
      address: "0x2a0777a42c42f714594a0f4e813fc2c0f9ef541e",
      startBlock,
    },
    DisputeManager: {
      chain,
      abi: DisputeManagerAbi,
      address: "0x5F23741C354b506C25D405598cF45cCb2BDba9d1",
      startBlock,
    },
  },
});
