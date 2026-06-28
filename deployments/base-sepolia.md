# Deflexy Protocol — Base Sepolia (chain 84532)

Deployed and **verified on Basescan**. Owner / guardian / arbitrator:
`0xBe8E12894f04c53f6EFd9f46C11275CE54fa7609`.
Allowlisted payment token: USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

| Contract            | Address                                      |
| ------------------- | -------------------------------------------- |
| Registry            | `0xBb51cd620a5328c8c30491686385B74a2d859f99` |
| ProfileRegistry     | `0x354fb8da7d5475b17e4d5a234b0d697bff68a0dd` |
| JobRegistry         | `0x3f5093e4ff021da840d8278ee3780a09b7bdb81f` |
| BidRegistry         | `0x043dc3649c51245f8e085315cd7f7273f608565e` |
| VaultManager        | `0xa44B1B44bC4f0f5F5BB823E1540c1C14aC3aAD1e` |
| WorkUnitManager     | `0x0eea19241a6e6627304d708eb355bc81889479c2` |
| ReputationRegistry  | `0x2a0777a42c42f714594a0f4e813fc2c0f9ef541e` |
| AgreementRegistry   | `0x81dF5CB950308a01C07240c7c4e267a0eE70DC70` |
| FeeManager          | `0xe54D35e7c0C15AD23BA5ec190c98E0dd8AEfF831` |
| PermissionManager   | `0xBAd70c60bF10a2893F95f561886E3660a1d06F52` |
| DisputeManager      | `0x5F23741C354b506C25D405598cF45cCb2BDba9d1` |

Explorer: `https://sepolia.basescan.org/address/<address>`

Re-deploy: `BASESCAN_API_KEY=... PRIVATE_KEY=0x... PAYMENT_TOKEN=0x036CbD53842c5426634e7929541eC2318f3dCF7e forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify`
