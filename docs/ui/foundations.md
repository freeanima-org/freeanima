---
title: Visual foundations
---

# Visual foundations

Visual language for Portal UI. Token **values** are defined only in [`src/ui-kit/styles/globals.css`](../../src/ui-kit/styles/globals.css). This page defines **intent, usage, and dimension adaptation**. Stack: Tailwind CSS v4 + shadcn/ui (`@freeanima/ui-kit`). DaisyUI is **not** used.

Each section uses the [dimension adaptation template](dimensions.md#dimension-adaptation-template).

Agent bans (raw CSS vars, DaisyUI tokens) → [`.agent/rules/frontend-ui.md`](../../.agent/rules/frontend-ui.md).

## Color and theme

**Intent:** Semantic surfaces and text, not ad-hoc hex. Dark mode via root `.dark`. Accent variants on dark via `data-color-theme` (`neutral` default, `ocean` / `forest` / `sunset` / `violet`) from local preference (`portal-sdk/color-theme`).

**Usage:** Tailwind semantic classes (`bg-background`, `text-muted-foreground`, `bg-primary`, `border-border`, …). Prefer `@apply` with those utilities over raw `var(--background)` outside `globals.css`.

| Lens        | Adaptation                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Invariant   | Semantic token names; light/dark pairs; destructive for irreversible risk                                                                  |
| Layout      | N/A (same palette); chrome may use `sidebar-*` tokens                                                                                      |
| Interaction | Hover/active tints (`hover:bg-muted`, `bg-primary/20` selection) only when pointer can hover; touch must not rely on hover-only color cues |
| Shell       | Accent theme is **local client preference**, not Shell kind; do not ship a separate palette per shell                                      |
| Forbidden   | DaisyUI `data-theme` / `--color-base-*`; choosing colors from `getShellKind()`                                                             |

**Pending alignment:** Feature-local one-off colors that bypass semantic tokens.

## Typography

**Intent:** Clear hierarchy — page/panel title, body, secondary, meta/label.

**Usage (current practice):** Panel titles often `text-lg font-semibold` or `text-sm font-semibold`; body `text-sm`; secondary/meta `text-xs text-muted-foreground`; truncate long titles with `truncate`.

| Lens        | Adaptation                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------- |
| Invariant   | Hierarchy roles (title / body / secondary / meta)                                             |
| Layout      | Compact may hide or shorten secondary lines; do not invent a second type scale per breakpoint |
| Interaction | Enlarge **hit targets** with spacing/min-height, not by breaking the type scale               |
| Shell       | N/A                                                                                           |
| Forbidden   | Different font stacks per shell                                                               |

## Spacing and density

**Intent:** Consistent padding and control heights; touch-friendly targets without sparse pointer UIs.

**Usage:** Control heights `h-8` / `h-9` / `h-10`; list rows often `min-h-11` + `px-1 py-1`; panel headers `p-3`.

| Lens        | Adaptation                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Invariant   | Spacing scale via Tailwind; shared row/control heights where possible                                                    |
| Layout      | Compact chrome must clear bottom nav (`--app-bottom-nav-h`); denser chrome, not denser unsafe hits                       |
| Interaction | **touch:** minimum ~44px hit target (`min-h-11`); **pointer:** may use denser icon buttons if hover/menu still reachable |
| Shell       | Safe-area insets via shell/host (`shared-safe-area.css`); not a second density system                                    |
| Forbidden   | `getShellKind()` to pick padding                                                                                         |

## Radius

**Intent:** Soft but consistent corners from `--radius` (and sm/md/lg/xl derivatives in `@theme`).

**Usage:** Controls/menus often `rounded-md` / `rounded-sm`; rows/Dialogs `rounded-lg`; pills/switches `rounded-full`; compact sheets may use larger top radius (`rounded-t-2xl`).

| Lens        | Adaptation                                                                     |
| ----------- | ------------------------------------------------------------------------------ |
| Invariant   | Radius tokens; map control vs surface roles                                    |
| Layout      | Sheet/drawer presentation may use larger top radius; Dialog stays `rounded-lg` |
| Interaction | N/A                                                                            |
| Shell       | N/A                                                                            |
| Forbidden   | One-off `rounded-[13px]` sprawl (**pending alignment** where present)          |

## Border and dividers

**Intent:** Separate regions with `border-border`; prefer list separators or muted backgrounds over card-in-card stacks.

| Lens        | Adaptation                                                                           |
| ----------- | ------------------------------------------------------------------------------------ |
| Invariant   | `border-border` / `border-input` for controls                                        |
| Layout      | Expanded multi-column uses column borders; compact drawers use edge borders + shadow |
| Interaction | N/A                                                                                  |
| Shell       | N/A                                                                                  |
| Forbidden   | Decorative multi-border chrome without information structure                         |

## Shadow and elevation

**Intent:** Elevation signals overlay/stacking, not decoration.

**Usage:** Controls `shadow-xs`; overlays/drawers `shadow-lg` sparingly.

| Lens        | Adaptation                                                |
| ----------- | --------------------------------------------------------- |
| Invariant   | Prefer semantic elevation steps; avoid stacked glow       |
| Layout      | Drawer/Sheet/Dialog use elevation; list rows usually flat |
| Interaction | N/A                                                       |
| Shell       | N/A                                                       |
| Forbidden   | Glow-as-brand; multi-layer shadows for idle chrome        |

## Iconography

**Intent:** Lucide icons; default size aligned with controls (`size-4` common).

| Lens        | Adaptation                                                      |
| ----------- | --------------------------------------------------------------- |
| Invariant   | Icon set and default size                                       |
| Layout      | N/A                                                             |
| Interaction | Enlarge **button hit box**, not the global icon size, for touch |
| Shell       | N/A                                                             |

## Motion

**Intent:** Transitions for open/close and state change (React Aria / shadcn animate). Motion clarifies hierarchy; it is not ornament.

| Lens        | Adaptation                                                         |
| ----------- | ------------------------------------------------------------------ |
| Invariant   | Prefer existing animate utilities                                  |
| Layout      | Sheet slide vs Dialog zoom follows presentation                    |
| Interaction | Do not depend on hover transitions for essential feedback on touch |
| Shell       | N/A                                                                |
| Forbidden   | Meaningless glow pulses                                            |

## Focus and keyboard

**Intent:** Visible `focus-visible` rings (`ring` / `ring-ring`). Dialogs/Sheets default to **blocking** auto-focus on open; confirm actions must not receive default focus.

| Lens        | Adaptation                                                                             |
| ----------- | -------------------------------------------------------------------------------------- |
| Invariant   | Focus rings; no stealth focus traps on destructive confirms                            |
| Layout      | N/A                                                                                    |
| Interaction | Keyboard users need visible focus; Enter-to-send is interaction capability, not layout |
| Shell       | External keyboard does not flip touch→pointer strategy                                 |
| Forbidden   | `autoFocus` on destructive confirm buttons                                             |

## Disabled and opacity

**Intent:** `disabled:opacity-50` + `pointer-events-none` on controls; completed/softened content may use `opacity-60`.

| Lens                         | Adaptation                  |
| ---------------------------- | --------------------------- |
| Invariant                    | Disabled affordance pattern |
| Layout / Interaction / Shell | N/A                         |

## Scrollbars and safe area

**Intent:** Global thin scrollbar styles (`ui-kit` scrollbar CSS). Safe-area CSS variables for notched devices; layout chrome clears bottom nav height.

| Lens        | Adaptation                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Invariant   | Shared scrollbar look                                                                                                                      |
| Layout      | Compact fixed layers respect `--app-bottom-nav-h`                                                                                          |
| Interaction | Pull-to-refresh ignores starts near left edge (drawer conflict) — see [patterns](patterns.md) / [page refresh](../aspects/page-refresh.md) |
| Shell       | Safe-area and keyboard inset host differences                                                                                              |
| Forbidden   | Theme colors inside safe-area-only CSS files                                                                                               |

## z-index

**Intent:** Stable stacking for menus, sheets, toasts. Prefer shared conventions over magic numbers.

| Lens        | Adaptation                                                                 |
| ----------- | -------------------------------------------------------------------------- |
| Invariant   | Overlay above chrome; do not cover bottom nav by raising z-index           |
| Layout      | Sheet/Dialog/Drawer stacking                                               |
| Interaction | Context menu / ActionSheet above content                                   |
| Shell       | N/A                                                                        |
| Forbidden   | Ad-hoc `z-[9999]` (**pending alignment** where present, e.g. some pickers) |

## Related

- Dimensions → [dimensions.md](dimensions.md)
- Components → [components.md](components.md)
- Patterns → [patterns.md](patterns.md)
