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

/** Deflexy v1 — Base Sepolia (chain 84532). */
export const baseSepoliaAddresses: DeflexyAddresses = {
  registry: "0xBb51cd620a5328c8c30491686385B74a2d859f99",
  profileRegistry: "0x354fb8da7d5475b17e4d5a234b0d697bff68a0dd",
  jobRegistry: "0x3f5093e4ff021da840d8278ee3780a09b7bdb81f",
  bidRegistry: "0x043dc3649c51245f8e085315cd7f7273f608565e",
  agreementRegistry: "0x81dF5CB950308a01C07240c7c4e267a0eE70DC70",
  vaultManager: "0xa44B1B44bC4f0f5F5BB823E1540c1C14aC3aAD1e",
  workUnitManager: "0x0eea19241a6e6627304d708eb355bc81889479c2",
  reputationRegistry: "0x2a0777a42c42f714594a0f4e813fc2c0f9ef541e",
  feeManager: "0xe54D35e7c0C15AD23BA5ec190c98E0dd8AEfF831",
  disputeManager: "0x5F23741C354b506C25D405598cF45cCb2BDba9d1",
  permissionManager: "0xBAd70c60bF10a2893F95f561886E3660a1d06F52",
};
