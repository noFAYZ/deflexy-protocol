import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { Icon } from "@iconify/react";
import { Connect } from "@/components/Connect";
import { Sidebar } from "@/components/Sidebar";
import { ProfilePage } from "@/components/ProfilePage";
import { CreateJobDialog } from "@/components/CreateJobDialog";
import { JobFeed } from "@/components/JobFeed";
import { JobDetail } from "@/components/JobDetail";
import { MyJobs } from "@/components/MyJobs";
import { FreelancerJobs } from "@/components/FreelancerJobs";
import { MyProposals } from "@/components/MyProposals";
import { Analytics } from "@/components/Analytics";
import { Directory } from "@/components/Directory";
import { Onboarding } from "@/components/Onboarding";
import { RoleSwitcher, type Role } from "@/components/RoleSwitcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useGlobalPending, useProfileId, useRegisterSigner } from "@/hooks";
import { cn } from "@/lib/utils";

type Tab = "marketplace" | "myjobs" | "myproposals" | "analytics" | "profile" | "directory";
const LIST_TABS: Tab[] = ["marketplace", "myjobs", "myproposals"];
const HOME: Record<Role, Tab> = { freelancer: "marketplace", client: "myjobs" };

const NAV: Record<Role, { tab: Tab; icon: string; label: string }[]> = {
  freelancer: [
    { tab: "marketplace", icon: "solar:shop-outline", label: "Find Jobs" },
    { tab: "myjobs", icon: "solar:case-minimalistic-outline", label: "My Jobs" },
    { tab: "myproposals", icon: "solar:hand-shake-outline", label: "My Proposals" },
  ],
  client: [{ tab: "myjobs", icon: "solar:case-minimalistic-outline", label: "My Jobs" }],
};

// Moved out of the sidebar into the header account menu.
const MENU: { tab: Tab; icon: string; label: string }[] = [
  { tab: "profile", icon: "solar:user-circle-outline", label: "Profile" },
  { tab: "directory", icon: "solar:users-group-rounded-outline", label: "Freelancers" },
  { tab: "analytics", icon: "hugeicons:analytics-up", label: "Analytics" },
];

export default function App() {
  useRegisterSigner();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const wrongNetwork = isConnected && chainId !== baseSepolia.id;
  const { data: profileId } = useProfileId();
  const hasProfile = !!profileId && profileId !== 0n;

  const [role, setRoleState] = useState<Role>(() => (localStorage.getItem("deflexy.role") as Role) || "freelancer");
  const [tab, setTab] = useState<Tab>(HOME[role]);
  const [selectedJobId, setSelectedJobId] = useState<bigint | null>(null);

  function setRole(r: Role) {
    setRoleState(r);
    localStorage.setItem("deflexy.role", r);
    setTab(HOME[r]);
    setSelectedJobId(null);
  }

  // Gate: visitors must connect, be on the right network, and have a profile.
  const gated = !isConnected || wrongNetwork || !hasProfile;
  function go(t: Tab) {
    setTab(t);
    setSelectedJobId(null);
  }
  const goHome = () => go(HOME[role]);
  const openJob = (id: bigint) => {
    if (!LIST_TABS.includes(tab)) setTab(HOME[role]);
    setSelectedJobId(id);
  };

  const showDetail = selectedJobId !== null && LIST_TABS.includes(tab);

  return (
    <>
      <PendingBar />
      {gated ? (
        <Onboarding role={role} setRole={setRole} />
      ) : (
        <div className="relative min-h-screen">
      {/* ambient brand glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-64 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        style={{ background: "radial-gradient(600px 240px at 50% -40px, var(--color-primary), transparent 70%)", opacity: 0.12 }}
      />

      <header className="border-border/60 bg-muted sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-14 container items-center justify-between gap-3 px-4">
          <button onClick={goHome} className="flex items-center gap-2.5">
            <img src="/logo/DeFlexy-Icon2.svg" alt="Deflexy" className="size-14" />
            <span className="text-[15px] font-semibold tracking-tight">Deflexy</span>
            <span className="border-primary/15 bg-primary/10 text-muted-foreground hidden items-center gap-1 rounded border px-1 py-0.5 text-[10px] font-medium sm:flex">
              <Icon icon={"token-branded:base"} className={cn("size-3")} /> Base Sepolia
            </span>
          </button>
          <div className="flex items-center gap-2">
            <RoleSwitcher role={role} onChange={setRole} />
            <ThemeSwitcher />
            <AccountMenu active={tab} onSelect={go} />
            <Connect />
          </div>
        </div>
      </header>

      <main className="mx-auto grid container gap-5 px-4 py-6 lg:grid-cols-[200px_minmax(0,1fr)_300px]">
        {/* Left — actions + nav */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          {role === "client" && <CreateJobDialog />}
          <nav className="space-y-0.5">
            {NAV[role].map((n) => (
              <NavItem key={n.tab} icon={n.icon} label={n.label} active={tab === n.tab} onClick={() => go(n.tab)} />
            ))}
          </nav>
        </aside>

        {/* Middle — master/detail */}
        <section className="min-w-0">
          {showDetail ? (
            <JobDetail jobId={selectedJobId!} onBack={() => setSelectedJobId(null)} />
          ) : tab === "analytics" ? (
            <Analytics />
          ) : tab === "directory" ? (
            <Directory />
          ) : tab === "profile" ? (
            <ProfilePage onSelect={openJob} />
          ) : tab === "myjobs" ? (
            role === "client" ? <MyJobs onSelect={setSelectedJobId} /> : <FreelancerJobs onSelect={setSelectedJobId} />
          ) : tab === "myproposals" ? (
            <MyProposals onSelect={setSelectedJobId} />
          ) : (
            <JobFeed onSelect={setSelectedJobId} />
          )}
        </section>

        {/* Right — context-aware rail */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Sidebar tab={tab} jobId={showDetail ? selectedJobId : null} />
        </aside>
      </main>
        </div>
      )}
    </>
  );
}

function PendingBar() {
  const pending = useGlobalPending();
  if (!pending) return null;
  return (
    <div className="bg-primary/15 fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
      <div className="bg-primary h-full w-1/3" style={{ animation: "deflexy-loadbar 1.1s ease-in-out infinite" }} />
      <style>{`@keyframes deflexy-loadbar{0%{transform:translateX(-120%)}100%{transform:translateX(420%)}}`}</style>
    </div>
  );
}

/** Header account dropdown — Profile + Analytics live here instead of the sidebar. */
function AccountMenu({ active, onSelect }: { active: Tab; onSelect: (t: Tab) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "grid size-7 place-items-center rounded-md border transition-colors",
          MENU.some((m) => m.tab === active) ? "bg-surface text-primary shadow-xs" : "text-muted-foreground hover:bg-surface/60",
        )}
        aria-label="Account menu"
      >
        <Icon icon="mage:user-circle" className="size-5" />
      </button>
      {open && (
        <>
          <button aria-hidden className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="bg-card absolute right-0 z-50 mt-1.5 w-44 rounded-xl border p-1 shadow-md">
            {MENU.map((m) => (
              <button
                key={m.tab}
                onClick={() => {
                  onSelect(m.tab);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-accent",
                  active === m.tab ? "bg-accent text-foreground" : "text-muted-foreground   hover:text-foreground",
                )}
              >
                <Icon icon={m.icon} className={cn("size-4", active === m.tab ? "text-primary" : "")} />
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg p-2 text-sm font-medium ",
        active ? "bg-accent text-foreground shadow-xs" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon icon={icon} className={cn("size-5", active ? " " : "")} />
      {label}
    </button>
  );
}
