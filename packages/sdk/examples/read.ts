// Read live Base Sepolia state through the SDK. Run: pnpm --filter @deflexy/sdk exec tsx examples/read.ts
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { createDeflexy, AgreementStatus, WorkUnitStatus } from "../src/index";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://84532.rpc.thirdweb.com"),
});

const deflexy = createDeflexy({ publicClient, indexerUrl: "http://localhost:42069" });

const freelancer = "0xbffbe5285D3C11e17B2b6360e68b24A0FC5FB7a7" as const;
const profileId = await deflexy.read.profileOf(freelancer);
console.log("freelancer profileId:", profileId.toString());

const ag = await deflexy.read.getAgreement(3n);
console.log("agreement #3:", {
  status: AgreementStatus[ag.status],
  model: ag.model,
  totalAmount: ag.totalAmount.toString(),
  freelancerProfileId: ag.freelancerProfileId.toString(),
  vaultId: ag.vaultId.toString(),
});

const wu = await deflexy.read.getWorkUnit(3n);
console.log("workUnit #3 status:", WorkUnitStatus[wu.status], "amount:", wu.amount.toString());

const [fee, net] = await deflexy.read.feeQuote(
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  1_000_000n,
);
console.log("fee quote on 1 USDC (fee now disabled):", { fee: fee.toString(), net: net.toString() });
