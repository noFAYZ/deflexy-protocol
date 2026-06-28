import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const baseStyles = [
  // Layout
  "inline-flex items-center justify-center",
  "w-fit shrink-0 whitespace-nowrap",
  "rounded-md",
  // Spacing
  "px-2 py-0.5",
  // Typography
  "text-xs font-medium",
  "leading-5",
  "tracking-wide",
  // Interaction
  "transition-colors duration-150",
  "select-none",
  // SVG handling
  "[&>svg]:size-3",
  "[&>svg]:shrink-0",
  "[&>svg]:pointer-events-none",
  // Focus
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-ring",
  "focus-visible:ring-offset-1",
] as const;

// Consistent flat color pattern: light bg + dark text, subtle dark mode
const flat = (
  light: string,
  dark: string,
) =>
  `bg-${light}-100 text-${light}-700 dark:bg-${dark}-950/40 dark:text-${dark}-400`;

export const badgeVariants = cva(baseStyles.join(" "), {
  variants: {
    variant: {
      // ─── Core ────────────────────────────────────────────
      default:
        "bg-primary text-primary-foreground shadow-xs",

      secondary:
        "bg-secondary text-secondary-foreground",

      muted:
        "bg-muted text-muted-foreground",

      outline:
        "border border-border bg-transparent text-foreground",

      ghost:
        "bg-transparent text-muted-foreground hover:bg-muted/80",

      // ─── Semantic ────────────────────────────────────────
      success:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",

      warning:
        "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",

      danger:
        "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",

      info:
        "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",

      // ─── Neutral Tones ───────────────────────────────────
      neutral:
        "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",

      subtle:
        "bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400",

      // ─── Extended Palette ────────────────────────────────
      violet:
        "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",

      purple:
        "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",

      fuchsia:
        "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-400",

      pink:
        "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400",

      rose:
        "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",

      orange:
        "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",

      lime:
        "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400",

      teal:
        "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",

      cyan:
        "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400",

      sky:
        "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",

      indigo:
        "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",

      slate:
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    },

    // Optional border style overlay
    border: {
      none: "",
      subtle: "border border-current/10",
      solid: "border border-current/20",
    },

    size: {
      xs: "h-4 px-1.5 text-[10px] rounded gap-0.5",
      sm: "h-5 px-2 text-[11px] rounded-sm gap-0.5",
      md: "h-6 px-2.5 text-xs rounded-md gap-1",
      lg: "h-7 px-3 text-sm rounded-md gap-1.5",
    },
  },

  defaultVariants: {
    variant: "default",
    border: "none",
    size: "sm",
  },
});

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

export function Badge({
  className,
  variant,
  border,
  size,
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(
        badgeVariants({ variant, border, size }),
        className
      )}
      {...props}
    />
  );
}