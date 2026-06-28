import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { baseSepolia } from "wagmi/chains";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { short } from "@/lib/format";
import { Icon } from "@iconify/react";


export function Connect() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <Button onClick={() => connect({ connector: injected() })} loading={isPending} size={'sm'} variant={'secondary'}>
          <Icon icon="ic:baseline-wallet" />

        {isPending ? "Connecting…" : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {chainId !== baseSepolia.id && (
        <Button variant="destructive" size="sm" onClick={() => switchChain({ chainId: baseSepolia.id })}>
          Wrong network
        </Button>
      )}
 
      <Button variant="logout" size="icon-sm" onClick={() => disconnect()} >
      <Icon icon="solar:logout-2-outline" className="size-3.5" />

   
      </Button>
    </div>
  );
}
