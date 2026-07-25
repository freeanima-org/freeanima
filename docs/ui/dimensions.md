---
title: UI dimensions
---

# UI dimensions (shell / layout / interaction)

Portal UI is designed along **three orthogonal dimensions**. Visual foundations, components, and interaction patterns all adapt through this lens. Phone size does **not** imply compact layout; Tauri does **not** imply touch.

Agent API tables and hard bans → [`.agent/rules/ui-dimensions.md`](../../.agent/rules/ui-dimensions.md). Implementation entry points are listed there; this page is the product narrative.

## Shell vs app frame

| Concept       | What it is                                                                  | Code                                                                      |
| ------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Shell**     | Portal runtime host (browser / Tauri; build targets web / desktop / mobile) | `src/app/shell/*`; `portal-sdk` (`getShellKind`, `ShellApi`, buildTarget) |
| **app frame** | Module rail / bottom tabs, settings chrome                                  | `src/client/app-frame` (`AppFrame`); follows **viewport**, not Shell      |

Do not call app frame “Shell”. Do not derive rail vs bottom tabs from Shell kind.

## The three dimensions

| Dimension       | Controls                                     | Values                          | How decided                                              | Stability                              |
| --------------- | -------------------------------------------- | ------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| **Shell**       | Capabilities (native APIs, files, push, IPC) | `web` / `tauri` (+ buildTarget) | Build + runtime (`getShellKind` / `getShellBuildTarget`) | Fixed per install                      |
| **Layout**      | Presentation (wide/narrow chrome, nav IA)    | `compact` / `expanded`          | CSS `matchMedia` (viewport)                              | Changes with window size               |
| **Interaction** | Input paradigm                               | `touch` / `pointer`             | `primaryInput` → `(pointer: fine)` + `(hover: hover)`    | Usually stable; can follow peripherals |

Colloquial “mobile layout / desktop layout” means `compact` / `expanded` — not phone shell / desktop shell.

## Core rules

- Dimensions are **orthogonal**: none may imply the other two.
- Forbidden: `isMobile = getShellKind() === "tauri"` (or similar mixes).
- Forbidden: one `isMobile` / `isDesktop` flag driving both layout and interaction.
- Components pick APIs by responsibility; do not hand-roll `isTauri && matchMedia(...)` to choose menus.

## What each dimension drives

### Shell → capabilities (`portal-sdk`)

Use for: file/FS bridges, notifications, Habitat settings visibility, hash navigation quirks, keyboard inset / safe-area host differences.

Do **not** use Shell kind to lock main nav (rail vs tabs), hover affordances, or Enter-to-send.

Unsupported capabilities return `null` / `false`; UI degrades.

### Layout → app frame and page structure

Use for: compact bottom nav + drawer vs expanded rail + multi-column; Dialog vs Sheet **presentation**; list-detail stacking; settings chrome (tabs vs sidebar via `detectSettingsChromePlatform()`).

Common layout patterns:

- **List-Detail** — side-by-side when expanded; stack + route when compact (`ListDetailLayout`)
- **Grid-List** — multi-column vs single column
- **Modal-Sheet** — centered Dialog when expanded; bottom Sheet when compact (presentation = layout; gesture = interaction)
- **Sidebar-Drawer** — fixed sidebar vs hamburger + drawer; compact viewport-fixed layers must clear `--app-bottom-nav-h`

Settings **section fields** may follow shell (`resolveSettingsContentPlatform()`); settings **chrome** follows layout.

### Interaction → input paradigm

Use for: ContextMenu vs ActionSheet / long-press; hover-revealed actions; Enter send vs newline; minimum hit targets.

Conventions:

- **touch** — hit targets ≥44px; no hover-only affordances; long-press / ActionSheet
- **pointer** — hover, right-click ContextMenu
- External keyboard on a pad does **not** flip interaction to pointer; strategy stays touch
- Keyboard-open **detection** is interaction; WebView resize differences may use shell helpers (e.g. `useKeyboardInset`)

### Pad example

| Dimension   | Value                                                    |
| ----------- | -------------------------------------------------------- |
| Shell       | `web` or `tauri` (how the user opened Portal)            |
| Layout      | Live viewport (landscape → expanded, portrait → compact) |
| Interaction | **touch** (`primaryInput: "touch"`)                      |

## Dimension adaptation template

When specifying visuals, components, or patterns, document:

1. **Dimension-invariant** — shared contract
2. **By layout** — compact vs expanded (or N/A)
3. **By interaction** — pointer vs touch (or N/A)
4. **By shell** — capability-only differences (or N/A)
5. **Forbidden mixes** — e.g. Shell deciding hover; viewport width deciding ContextMenu vs ActionSheet

## Related

- Visual foundations → [foundations.md](foundations.md)
- Components → [components.md](components.md)
- Patterns → [patterns.md](patterns.md)
- Agent rules → [`.agent/rules/ui-dimensions.md`](../../.agent/rules/ui-dimensions.md)
