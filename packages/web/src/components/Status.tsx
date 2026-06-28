import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SERVICES } from "@/lib/health";
import { cn } from "@/lib/utils";

type State = "checking" | "online" | "offline";

const DOT: Record<State, string> = {
  checking: "bg-muted-foreground/40 animate-pulse",
  online: "bg-emerald-500",
  offline: "bg-destructive",
};
const LABEL: Record<State, string> = { checking: "Checking…", online: "Online", offline: "Offline" };

/** Dependency dashboard — pings the API, indexer and RPC and shows each up/down.
 *  Reached at #/status; auto-refreshes every 15s. */
export function Status() {
  const [states, setStates] = useState<State[]>(() => SERVICES.map(() => "checking"));
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const run = useCallback(() => {
    setStates(SERVICES.map(() => "checking"));
    SERVICES.forEach((s, i) =>
      s.check().then((ok) =>
        setStates((prev) => {
          const next = [...prev];
          next[i] = ok ? "online" : "offline";
          return next;
        }),
      ),
    );
    setCheckedAt(new Date());
  }, []);

  useEffect(() => {
    run();
    const id = setInterval(run, 15_000);
    return () => clearInterval(id);
  }, [run]);

  const offline = states.filter((s) => s === "offline").length;
  const checking = states.some((s) => s === "checking");
  const banner = checking
    ? { icon: "svg-spinners:90-ring-with-bg", text: "Checking services…", tone: "text-muted-foreground" }
    : offline === 0
      ? { icon: "solar:check-circle-bold", text: "All systems operational", tone: "text-emerald-500" }
      : { icon: "solar:danger-triangle-bold", text: `${offline} service${offline > 1 ? "s" : ""} offline`, tone: "text-destructive" };

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <a href="#/" className="flex items-center gap-2">
          <img src="/logo/DeFlexy-Icon2.svg" alt="Deflexy" className="size-10" />
          <span className="text-sm font-semibold tracking-tight">Deflexy</span>
        </a>
        <ThemeSwitcher />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl border p-6 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Icon icon={banner.icon} className={cn("size-6", banner.tone)} />
              <h1 className="text-lg font-semibold tracking-tight">{banner.text}</h1>
            </div>

            <ul className="mt-5 space-y-1">
              {SERVICES.map((s, i) => (
                <li key={s.name} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-surface/60">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-muted-foreground truncate text-xs">{s.url}</div>
                  </div>
                  <div className="flex items-center gap-2 pl-3">
                    <span className={cn("size-2 rounded-full", DOT[states[i]])} />
                    <span className="text-muted-foreground w-14 text-right text-xs">{LABEL[states[i]]}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-center justify-between">
              <span className="text-muted-foreground text-xs">
                {checkedAt ? `Checked ${checkedAt.toLocaleTimeString()}` : ""}
              </span>
              <Button size="sm" variant="outline" onClick={run} disabled={checking}>
                <Icon icon="solar:refresh-outline" className="size-4" /> Refresh
              </Button>
            </div>
          </div>

          <a href="#/" className="text-muted-foreground hover:text-foreground mt-4 block text-center text-xs">
            ← Back to app
          </a>
        </div>
      </main>
    </div>
  );
}
