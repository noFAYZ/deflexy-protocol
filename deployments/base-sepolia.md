# Deflexy Protocol — Base Sepolia (chain 84532)

Redeployed with the **hardened contracts** (audit + SettlementModel/dispute-reputation).
Deploy block `43475604`. Owner / guardian / arbitrator:
`0xBe8E12894f04c53f6EFd9f46C11275CE54fa7609`.
Allowlisted payment token: USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

| Contract            | Address                                      |
| ------------------- | -------------------------------------------- |
| Registry            | `0x1B9c1da59224A96cEAAb1609a3c703E2b9Ec801c` |
| ProfileRegistry     | `0xf72e686f93AbFF7e39A0533211abE470bC71b3C8` |
| JobRegistry         | `0x10cC66641B6A08827E967889Ad4c3B12De175474` |
| BidRegistry         | `0xc213d08867c7e49110BB3265Cbaeceb5da1DD8B8` |
| VaultManager        | `0xE0524a20cC0c6Aa96eC66Ebae15e49B9Af9D72cE` |
| WorkUnitManager     | `0x88321Fee43B75edc032e7A7d0bF16d10bB8dC244` |
| ReputationRegistry  | `0xb1fDAD433E505EBb7361Dea7DeB2c2BF15A1E79b` |
| AgreementRegistry   | `0x4b3291459B354B1988759f52A693c59F91334d7F` |
| FeeManager          | `0xD4C4BEc9c82e9CE59eAB1867ef8aCF3028F912dd` |
| PermissionManager   | `0x4489b648682A396068875a8Cda636286bC864098` |
| DisputeManager      | `0x6cBAB889E6ad3e1f9E4631DF848E928aD41b9cFb` |

Explorer: `https://sepolia.basescan.org/address/<address>`

Re-deploy: `BASESCAN_API_KEY=... PRIVATE_KEY=0x... PAYMENT_TOKEN=0x036CbD53842c5426634e7929541eC2318f3dCF7e forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify`
