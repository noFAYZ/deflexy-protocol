import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        // Segmented pill container
        default: "gap-0.5 rounded-lg bg-muted p-[3px]",
        // Clean underline container
        line: "gap-4 border-b border-border bg-transparent",
        // Minimal text-only container
        ghost: "gap-1 bg-transparent",
        // Bordered box container
        outline: "gap-0 rounded-lg border border-border bg-transparent p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // ─── Base Styles ────────────────────────────────
        "relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2.5 py-1 text-sm font-medium transition-colors",
        "group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start",
        "hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        
        // ─── Variant: Default (Pill) ────────────────────
        "group-data-[variant=default]/tabs-list:text-foreground/60 dark:group-data-[variant=default]/tabs-list:text-muted-foreground",
        "group-data-[variant=default]/tabs-list:data-[state=active]:bg-background",
        "group-data-[variant=default]/tabs-list:data-[state=active]:text-foreground",
        "group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm",
        "dark:group-data-[variant=default]/tabs-list:data-[state=active]:bg-input/30",

        // ─── Variant: Line (Underline) ──────────────────
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:px-0",
        "group-data-[variant=line]/tabs-list:text-foreground/60 dark:group-data-[variant=line]/tabs-list:text-muted-foreground",
        "group-data-[variant=line]/tabs-list:data-[state=active]:text-foreground",
        // Underline pseudo-element (scoped strictly to line variant)
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity",
        "group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-1px] group-data-[orientation=horizontal]/tabs:after:h-0.5",
        "group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5",
        "group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",

        // ─── Variant: Ghost (Minimal) ───────────────────
        "group-data-[variant=ghost]/tabs-list:text-muted-foreground",
        "group-data-[variant=ghost]/tabs-list:hover:bg-accent",
        "group-data-[variant=ghost]/tabs-list:data-[state=active]:bg-accent",
        "group-data-[variant=ghost]/tabs-list:data-[state=active]:text-foreground",
        "group-data-[variant=ghost]/tabs-list:data-[state=active]:font-semibold",

        // ─── Variant: Outline (Bordered) ────────────────
        "group-data-[variant=outline]/tabs-list:rounded-none group-data-[variant=outline]/tabs-list:border-b-2 group-data-[variant=outline]/tabs-list:border-transparent",
        "group-data-[variant=outline]/tabs-list:text-muted-foreground",
        "group-data-[variant=outline]/tabs-list:hover:text-foreground",
        "group-data-[variant=outline]/tabs-list:data-[state=active]:border-foreground",
        "group-data-[variant=outline]/tabs-list:data-[state=active]:text-foreground",
        "group-data-[variant=outline]/tabs-list:data-[state=active]:font-medium",

        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "mt-2 outline-none",
        // Add top margin/padding adjustments based on list variant if needed
        "group-data-[variant=default]/tabs:mt-3",
        "group-data-[variant=line]/tabs:mt-4",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }