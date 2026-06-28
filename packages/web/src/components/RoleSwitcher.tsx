import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

export type Role = "freelancer" | "client";

const OPTIONS: { role: Role; label: string; icon: string }[] = [
  { role: "freelancer", label: "Seller", icon: "solar:user-speak-rounded-linear" },
  { role: "client", label: "Buyer", icon: "solar:user-hand-up-linear" },
];

export function RoleSwitcher({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  const activeIndex = OPTIONS.findIndex((o) => o.role === role);

  return (
    <div className="relative inline-flex rounded-full p-0.5 bg-accent shadow-inner">
      <div
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-card shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />

      {OPTIONS.map((o) => {
        const isActive = role === o.role;
        return (
          <button
            key={o.role}
            onClick={() => onChange(o.role)}
            className={cn(
              "relative z-10 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium",
              "transition-colors duration-100 active:scale-95",
            
              isActive ? "text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground",
            )}
            aria-pressed={isActive}
          >
            <Icon
              icon={o.icon}
              className={cn(
                "size-3 transition-colors duration-150",
                isActive && "text-primary",
              )}
            />
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}