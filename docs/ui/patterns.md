---
title: Interaction patterns
---

# Interaction patterns

Reusable interaction contracts so modules (task, chat, email, …) share one UX language. Prefer existing `@freeanima/ui-kit/composite` implementations over parallel menus, rows, or confirms.

Dimensions → [dimensions.md](dimensions.md). Components → [components.md](components.md). Visuals → [foundations.md](foundations.md).

## Pattern card template

Every pattern documents:

1. **Intent** — when to use
2. **Slots** — required/optional UI parts
3. **States** — default, hover, selected, active, dragging, selectionMode, disabled, …
4. **Dimension adaptation** — invariant / layout / interaction / shell (N/A if none)
5. **Implementation** — code entry (or “pending extraction”)
6. **Forbidden** — anti-patterns
7. **Compliance** — reference / pending extraction / pending alignment

---

## DataListRow

**Intent:** Primary row in a data list (tasks, mail threads, …): title, actions, selection, optional drag, overflow menu.

**Slots:**

| Slot                         | Role                                                                    |
| ---------------------------- | ----------------------------------------------------------------------- |
| Leading control              | Complete checkbox, or selection glyph in `selectionMode`                |
| Title                        | Primary truncated text                                                  |
| Secondary line / tags / meta | Optional muted line, tags, due date, entity id                          |
| Persistent actions           | Always-visible controls needed without hover (e.g. touch ⋯)             |
| Hover actions                | Pointer-only revealed controls (`group-hover`) when used                |
| Overflow menu source         | Shared `ActionSheetItem[]` for ContextMenu and ActionSheet              |
| Drag handle                  | Prefer **whole-row** drag listeners; no separate handle unless required |

**States:**

| State         | Visual / behavior                                                                 |
| ------------- | --------------------------------------------------------------------------------- |
| default       | Row chrome; `min-h-11`                                                            |
| hover         | `hover:bg-muted` (pointer); must not be the only way to discover actions on touch |
| active        | Current detail target (subtle ring/bg) when not selected                          |
| selected      | Stronger primary tint + ring; used in multi-select                                |
| selectionMode | Checkbox → selection glyph; click toggles; disable drag/menus                     |
| dragging      | Reduced opacity; grab cursor when draggable                                       |
| disabled      | Controls disabled; no drag                                                        |

**Dimension adaptation:**

| Lens        | Adaptation                                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invariant   | Same slot contract across modules; do not ship a second row component per breakpoint                                                                                                                        |
| Layout      | Outer List-Detail / columns change; **row slots stay the same** in compact and expanded                                                                                                                     |
| Interaction | **pointer:** hover bg; right-click `ContextMenu` when enabled; optional hover-revealed actions. **touch:** no hover-only actions; persistent ⋯ (or equivalent); long-press → ActionSheet; hit targets ≥44px |
| Shell       | N/A                                                                                                                                                                                                         |
| Forbidden   | `getShellKind()` to choose menu type; viewport width to choose ContextMenu vs ActionSheet; custom `fixed` coordinate menus                                                                                  |

**Implementation:** Chassis — [`ListRow.tsx`](../../src/ui-kit/composite/ListRow.tsx). Task domain — [`TaskItemRowView.tsx`](../../src/ui-kit/composite/TaskItemRowView.tsx) (+ list wrapper `TaskItemListView`). Consumers: project sidebar, task list sidebar, smart-list sidebar, email message/account rows, chat conversation list. Capability flags: `useActionSheet`, `contextMenuEnabled`, drag attrs/listeners from parent.

**Compliance:** Reference (chassis extracted). **Pending alignment (P2/P3):** MoveTo*Picker tree rows; Vault/diary/pomodoro pickers; Habitat admin; extension popup.

---

## OverflowMenu

**Intent:** Secondary actions on an object without cluttering the row.

**Slots:** Item list (`ActionSheetItem[]`: label, action, destructive flag, …); optional trigger (⋯).

**States:** Closed / open; destructive items styled distinctly; disabled when `selectionMode` or row disabled.

**Dimension adaptation:**

| Lens        | Adaptation                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Invariant   | One item builder; both surfaces consume the same array                                                                                    |
| Layout      | ActionSheet may present as bottom sheet; ContextMenu is anchored — presentation details follow primitives                                 |
| Interaction | **pointer:** `ContextMenu`. **touch:** `ActionSheet` + long-press and/or ⋯. Separate state machines; shared session data (target + items) |
| Shell       | N/A                                                                                                                                       |
| Forbidden   | Parallel hand-rolled menus; `window.confirm` inside menu actions for irreversible deletes (use ConfirmDestructive)                        |

**Implementation:** `@freeanima/ui-kit/composite` — `ContextMenu`, `ActionSheet`, `useLongPress`.

**Compliance:** Reference.

---

## ConfirmDestructive

**Intent:** Confirm irreversible or high-risk actions (delete, purge).

**Slots:** Title, description, cancel, confirm (destructive/error variant).

**States:** Open/closed; confirm button must **not** be default-focused or “easy Enter” default.

**Dimension adaptation:**

| Lens        | Adaptation                                                                   |
| ----------- | ---------------------------------------------------------------------------- |
| Invariant   | Second confirmation for irreversible delete; `showConfirm` / `ConfirmDialog` |
| Layout      | Dialog vs Sheet presentation may follow ModalSheetPresent                    |
| Interaction | Same confirm semantics on pointer and touch                                  |
| Shell       | N/A                                                                          |
| Forbidden   | `window.confirm`; `autoFocus` on confirm                                     |

**Implementation:** `ConfirmDialog`, `showConfirm` from `@freeanima/ui-kit/composite`.

**Compliance:** Reference.

---

## ModalSheetPresent

**Intent:** Modal content presentation that tracks **layout**, not shell.

**Slots:** Title, body, footer actions; optional close.

**Dimension adaptation:**

| Lens        | Adaptation                                                                            |
| ----------- | ------------------------------------------------------------------------------------- |
| Invariant   | Same content model                                                                    |
| Layout      | **expanded:** centered `Dialog`. **compact:** bottom `Sheet` / sheet-like surface     |
| Interaction | Opening gesture is separate (button vs long-press); do not conflate with presentation |
| Shell       | N/A                                                                                   |
| Forbidden   | `getShellKind() === "tauri"` ⇒ Sheet                                                  |

**Implementation:** shadcn `Dialog` / `Sheet` via composite `ModalSheetPresent`; pickers (`MoveToListPicker`, `MoveToProjectPicker`) use that shell. Do **not** hand-roll `createPortal` + fixed overlays.

**Task detail (compact):** peek `Sheet` for browse/display; focusing title or notes enters an **immersive full-page edit** (`DetailEditPageShell` + `setCompactImmersive`) with a back control and **no bottom tabs**. Back / system back closes the detail and returns to the **list** (does not restore peek). Layout-driven — not shell kind.

**Compliance:** Reference.

---

## QuickAddBar

**Intent:** Single-line quick create at the edge of a list (tasks, project tasks).

**Slots:** Text input; submit button (always visible).

**States:** Empty / filled; disabled when writes blocked.

**Dimension adaptation:**

| Lens        | Adaptation                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| Invariant   | Same slots; submit button always present                                                                         |
| Layout      | Top or bottom chrome via `className` (border direction); does not switch List-Detail                             |
| Interaction | `enterToSubmit` (default true for single-line). Multi-line composers inject `useEnterToSendCapability()` instead |
| Shell       | N/A                                                                                                              |
| Forbidden   | Rely on Enter alone on touch; hide submit control for touch-primary                                              |

**Implementation:** [`QuickAddBar.tsx`](../../src/ui-kit/composite/QuickAddBar.tsx).

**Compliance:** Reference.

---

## PullToRefresh

**Intent:** Refresh primary list content via touch pull; pointer uses a separate header refresh control.

**Slots:** Scrollable content; pull indicator / spinner.

**Dimension adaptation:**

| Lens        | Adaptation                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------- |
| Invariant   | Same `onRefresh` callback                                                                           |
| Layout      | N/A (wraps list scroller)                                                                           |
| Interaction | **touch:** pull gesture (default auto-detect). **pointer:** disable pull; use header refresh button |
| Shell       | N/A                                                                                                 |
| Forbidden   | `getShellKind()` to enable pull                                                                     |

**Implementation:** [`PullToRefresh.tsx`](../../src/ui-kit/composite/PullToRefresh.tsx). Product note → [page-refresh.md](../aspects/page-refresh.md).

**Compliance:** Reference.

---

## ListDetail / ThreeColumn

**Intent:** Page chassis for list + detail (+ optional third column).

**Slots:** Sidebar / middle / detail; drawer vs columns.

**Dimension adaptation:**

| Lens        | Adaptation                                                                           |
| ----------- | ------------------------------------------------------------------------------------ |
| Invariant   | Same content slots                                                                   |
| Layout      | `useDrawerNav` / `useThreeColumnLayoutMode` / `useCompactLayout` switch presentation |
| Interaction | N/A for chassis; menus stay on rows                                                  |
| Shell       | N/A                                                                                  |
| Forbidden   | `getShellKind()` ⇒ drawer or tabs                                                    |

**Implementation:** [`ListDetailLayout.tsx`](../../src/ui-kit/layout/ListDetailLayout.tsx), ThreeColumnLayout; chrome helpers [`DetailPanelShell.tsx`](../../src/ui-kit/composite/DetailPanelShell.tsx), [`ModuleScopeBar.tsx`](../../src/ui-kit/composite/ModuleScopeBar.tsx).

**Compliance:** Reference.

---

## EmptyState / StatusAlert

**Intent:** Empty list guidance; inline error/status messaging.

**Slots:** Message (+ optional action for EmptyState); variant for StatusAlert.

**Dimension adaptation:** Invariant copy and placement; layout may change padding; interaction/shell N/A.

**Implementation:** [`EmptyState.tsx`](../../src/ui-kit/composite/EmptyState.tsx), [`StatusAlert.tsx`](../../src/ui-kit/composite/StatusAlert.tsx).

**Compliance:** Reference.

---

## Candidates (later)

Document when stabilizing a second consumer or further extraction:

- (none currently — QuickAddBar / PullToRefresh / ListDetail / EmptyState / ModuleScopeBar promoted above)

## New UI checklist

- [ ] Chose a pattern (or extended the catalog) instead of inventing a parallel gesture
- [ ] Documented dimension adaptation (layout + interaction at minimum)
- [ ] Menus share one item list; no fixed-position DIY menus
- [ ] Irreversible actions use ConfirmDestructive
- [ ] Touch paths do not depend on hover-only affordances
- [ ] Shell kind does not lock layout or menu type

## Related

- Page refresh verbs → [aspects/page-refresh.md](../aspects/page-refresh.md)
- Agent UI rules → [`.agent/rules/frontend-ui.md`](../../.agent/rules/frontend-ui.md)
