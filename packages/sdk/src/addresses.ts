import type { Address } from "viem";

export interface DeflexyAddresses {
  registry: Address;
  profileRegistry: Address;
  jobRegistry: Address;
  bidRegistry: Address;
  agreementRegistry: Address;
  vaultManager: Address;
  workUnitManager: Address;
  reputationRegistry: Address;
  feeManager: Address;
  disputeManager: Address;
  permissionManager: Address;
}

/** Deflexy v1 — Base Sepolia (chain 84532). Redeployed with the hardened contracts. */
export const baseSepoliaAddresses: DeflexyAddresses = {
  registry: "0x1B9c1da59224A96cEAAb1609a3c703E2b9Ec801c",
  profileRegistry: "0xf72e686f93AbFF7e39A0533211abE470bC71b3C8",
  jobRegistry: "0x10cC66641B6A08827E967889Ad4c3B12De175474",
  bidRegistry: "0xc213d08867c7e49110BB3265Cbaeceb5da1DD8B8",
  agreementRegistry: "0x4b3291459B354B1988759f52A693c59F91334d7F",
  vaultManager: "0xE0524a20cC0c6Aa96eC66Ebae15e49B9Af9D72cE",
  workUnitManager: "0x88321Fee43B75edc032e7A7d0bF16d10bB8dC244",
  reputationRegistry: "0xb1fDAD433E505EBb7361Dea7DeB2c2BF15A1E79b",
  feeManager: "0xD4C4BEc9c82e9CE59eAB1867ef8aCF3028F912dd",
  disputeManager: "0x6cBAB889E6ad3e1f9E4631DF848E928aD41b9cFb",
  permissionManager: "0x4489b648682A396068875a8Cda636286bC864098",
};
