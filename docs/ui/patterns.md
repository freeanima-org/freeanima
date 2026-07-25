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

**Implementation:** Reference — [`TaskItemRowView.tsx`](../../src/ui-kit/composite/TaskItemRowView.tsx) (+ list wrapper `TaskItemListView`). Capability flags: `useActionSheet`, `contextMenuEnabled`, drag attrs/listeners from parent.

**Compliance:** Reference implementation (task-shaped). **Pending extraction:** domain-agnostic `ListRow` chassis. **Pending alignment:** other modules’ custom rows that diverge on menus/selection/drag.

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

**Implementation:** shadcn `Dialog` / `Sheet`; pickers such as `MoveToListPicker` follow the same idea.

**Compliance:** Reference (with **pending alignment** on ad-hoc z-index values).

---

## Candidates (later)

Document when stabilizing a second consumer:

- QuickAddBar
- PullToRefresh (see also [page refresh](../aspects/page-refresh.md) — pointer header button vs touch pull)
- ListDetail / ThreeColumn page chassis
- EmptyState / StatusAlert surfaces as full pattern cards
- ModuleScopeBar / DetailPanelShell

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
