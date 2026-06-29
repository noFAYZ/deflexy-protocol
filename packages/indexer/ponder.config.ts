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
const startBlock = 43_475_600; // just before the deployment txs (block 43_475_604)

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
      address: "0xf72e686f93AbFF7e39A0533211abE470bC71b3C8",
      startBlock,
    },
    JobRegistry: {
      chain,
      abi: JobRegistryAbi,
      address: "0x10cC66641B6A08827E967889Ad4c3B12De175474",
      startBlock,
    },
    BidRegistry: {
      chain,
      abi: BidRegistryAbi,
      address: "0xc213d08867c7e49110BB3265Cbaeceb5da1DD8B8",
      startBlock,
    },
    AgreementRegistry: {
      chain,
      abi: AgreementRegistryAbi,
      address: "0x4b3291459B354B1988759f52A693c59F91334d7F",
      startBlock,
    },
    VaultManager: {
      chain,
      abi: VaultManagerAbi,
      address: "0xE0524a20cC0c6Aa96eC66Ebae15e49B9Af9D72cE",
      startBlock,
    },
    WorkUnitManager: {
      chain,
      abi: WorkUnitManagerAbi,
      address: "0x88321Fee43B75edc032e7A7d0bF16d10bB8dC244",
      startBlock,
    },
    ReputationRegistry: {
      chain,
      abi: ReputationRegistryAbi,
      address: "0xb1fDAD433E505EBb7361Dea7DeB2c2BF15A1E79b",
      startBlock,
    },
    DisputeManager: {
      chain,
      abi: DisputeManagerAbi,
      address: "0x6cBAB889E6ad3e1f9E4631DF848E928aD41b9cFb",
      startBlock,
    },
  },
});
