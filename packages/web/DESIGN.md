# Deflexy — Web Design Standard

The look established in the marketplace revamp is the **standard** for all UI in
this app. New screens/components must follow it. Principles: **modern, minimal,
compact, functional, dark-first.** Build on tokens — never hardcode colors,
shadows, or radii.

---

## 1. Tokens (defined in `src/index.css` — use these, don't invent)

- **Brand:** `primary` (purple, oklch hue 292) + `primary-50…900` scale. Icons/accents: `text-primary`.
- **Surfaces (elevation):** `background` → `card` → `surface` → `surface-2` → `surface-3`. Use `surface` for insets/hover, `card` for raised panels.
- **Text:** `foreground` (primary), `muted-foreground` (secondary/meta).
- **Semantic:** `success`, `warning`, `destructive`, `info` (+ Badge variants below).
- **Lines:** hairlines use `border-border/60` (or `/50` inside divided lists).
- **Radius:** `--radius` ≈ 14px → `rounded-lg` / `rounded-xl` for cards, `rounded-md` for controls, `rounded-full` for chips/avatars.
- **Shadows:** `shadow-xs` for cards/rows/active states. Reserve `shadow-sm/md/lg` for overlays. No heavy shadows.
- **Font:** `Matter` (`--font-sans`), weights 400/500/600/700. `font-mono` for addresses, amounts, ids.
- **Motion:** `transition-colors` (or `transition-all`) at ~150–220ms. Subtle.

## 2. Layout

- Page width `max-w-6xl`, padding `px-4 py-6`.
- **Header:** sticky glass — `sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl`, height `h-14`. Logo (`/logo/DeFlexy-Icon2.svg`, `size-7`) + wordmark + a context chip.
- **Shell:** 3-col grid `lg:grid-cols-[200px_minmax(0,1fr)_300px] gap-5`; side rails are `lg:sticky lg:top-20 lg:self-start`.
- Optional **ambient glow** behind header (radial, `opacity ~0.12`).

## 3. Component recipes (copy these)

**Dense list** (preferred over per-row cards for any list):
```
container: border border-border/60 bg-card rounded-xl shadow-xs divide-y divide-border/50 overflow-hidden
row:       flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface/70 transition-colors
```

**Card panel:** shadcn `<Card>` (`bg-card border rounded-xl shadow-xs`), compact `py-5`.

**Nav item:**
```
base:     flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors
active:    bg-surface text-foreground shadow-xs   (icon: text-primary)
inactive:  text-muted-foreground hover:bg-surface/60 hover:text-foreground
```

**Segmented control:** `inline-flex bg-surface rounded-lg p-0.5`; segment `rounded-md px-2.5 py-1`, active `bg-card text-foreground shadow-xs`.

**Stat tile:** `bg-surface/60 rounded-lg border px-3 py-2` → value `text-sm font-semibold`, label `text-[11px] text-muted-foreground`.

**Skeleton:** `bg-surface/60 animate-pulse rounded-xl h-[…]`. Always show during load.

**Empty state:** centered, `rounded-xl border border-dashed border-border/60 py-12 text-muted-foreground` with a muted lucide icon.

**Icons:** **Iconify** via `@iconify/react` — `<Icon icon="solar:shop-outline" className="size-5" />`. Prefer the **`solar`** set (outline weight) for UI, `hugeicons` where it fits. `size-5` in nav/headers/metric badges, `size-4` inline. Brand-tint accents with `text-primary`. (lucide is fine for tiny inline glyphs already in place.)

**Buttons:** shadcn `<Button>` with the `loading` prop (auto spinner + disabled). Primary = main action, `ghost` = nav/tertiary, `outline`/`secondary` = secondary. Sizes `default`/`sm`.

**Metric tile** (analytics/KPIs): `bg-card rounded-xl border shadow-xs p-3.5 flex items-center gap-3`; icon in a `bg-primary/10 text-primary size-9 rounded-lg` badge; value `text-xl font-semibold`, label `text-xs text-muted-foreground`.

**Section label:** `text-muted-foreground text-xs font-medium tracking-wide uppercase` above a grid/list.

**Status → Badge variant:** always via `jobStatusVariant()` / the agreement/work-unit mappers — Open→`success`, Filled→`warning`, Completed→`secondary`, Cancelled→`destructive`. Never hardcode status colors.

## 4. Density & type scale

- Body `text-sm`, meta `text-xs`, micro-labels `text-[11px]`, headings `text-lg font-semibold tracking-tight`.
- Spacing: list rows `px-4 py-3`, cards `py-5`, grids `gap-5`, stacks `space-y-4`.
- Numbers/addresses/ids in `font-mono`; addresses via `short()`.

## 5. Feedback

- Every transaction routes through `useTx` / `useBatchTx` → a **toast** (pending → confirmed/failed) **and** a button spinner. Don't fire writes outside these hooks.

## 6. Do / Don't

- **Do:** reuse the recipes above, lean on tokens, keep it dense and quiet.
- **Don't:** add ad-hoc hex colors, heavy shadows, large paddings, per-row `<Card>` for long lists, or status colors outside the Badge variants.

Assets: logo icon `/logo/DeFlexy-Icon2.svg`; full lockups `DeFlexy-dark.svg` / `DeFlexy-light.svg`.
