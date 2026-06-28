
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-3",
    "whitespace-nowrap",
    "rounded-[var(--radius)]",
    "font-medium",
    "select-none",
    "shrink-0",
    "transition-[color,background-color,border-color,box-shadow,transform]",
    "duration-100",
    "ease-out",
    "outline-none",
    "active:scale-[0.98]",
    "disabled:pointer-events-none",
    "disabled:opacity-50",
    "disabled:shadow-none",
    "focus-visible:ring-1",
    "focus-visible:ring-ring/50",
    "focus-visible:ring-offset-2",
    "focus-visible:ring-offset-background",
    "[&_svg]:pointer-events-none",
    "[&_svg]:shrink-0",
    "[&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",

        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",

        outline:
          "border border-border bg-background hover:bg-accent hover:text-accent-foreground",

        ghost:
          "hover:bg-accent hover:text-accent-foreground",

        tinted:
          "bg-primary/10 text-primary hover:bg-primary/15",

        glass:
          "border border-primary/10 bg-primary/5 backdrop-blur-xl hover:bg-primary/10",

        frosted:
          "border border-border/50 bg-background/70 backdrop-blur-xl hover:bg-background/80",

        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",

        success:
          "bg-success text-white hover:brightness-95",

        logout:
          "bg-orange-600/30  text-orange-900 hover:brightness-75",

        warning:
          "bg-warning text-black hover:brightness-75",

        info:
          "bg-info text-white hover:brightness-75",

        filled:
          "bg-foreground text-background hover:opacity-90",

        link:
          "h-auto rounded-none p-0 text-primary underline-offset-4 hover:underline shadow-none",
      },

      size: {
        xs: "h-7 px-2.5 text-xs",

        sm: "h-7 px-2 text-sm",

        default: " py-2 px-3 text-md",

        md: "h-10 px-5 text-sm",

        lg: "h-11 px-6 text-base",

        xl: "h-12 px-8 text-base",

        icon: "size-9 p-0",

        "icon-sm": "size-7 p-0",

        "icon-lg": "size-11 p-0",

        toolbar: "h-9 px-2",

        square: "size-10 p-0",

        pill: "h-10 rounded-full px-6",

        "pill-lg": "h-12 rounded-full px-8",
      },
    },

    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size }),
        loading && "cursor-wait",
        className
      )}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <Loader2
          className="size-4 animate-spin"
          aria-hidden="true"
        />
      )}

      {children}
    </Comp>
  );
}

export { Button, buttonVariants };
