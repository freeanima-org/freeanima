---
title: UI components
---

# UI components

Taxonomy and placement rules for Portal UI. Implementation lives under `src/ui-kit/` and `src/features/*/ui/`. Agent import bans → [`.agent/rules/frontend-ui.md`](../../.agent/rules/frontend-ui.md) and [`.agent/rules/frontend-features.md`](../../.agent/rules/frontend-features.md).

Visual tokens → [foundations.md](foundations.md). Dimension axes → [dimensions.md](dimensions.md).

## Spoken terms → repository terms

| Spoken (product/design)         | Repository term                                                                      | Typical home                  |
| ------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------- |
| Non-business / design-system UI | **Primitive**, **structure**, **composite**                                          | `@freeanima/ui-kit`           |
| Business / product UI           | **Domain** UI                                                                        | `src/features/<slug>/ui`      |
| UI component                    | A React building block at one of the layers above                                    | —                             |
| UI element / slot piece         | Presentational part inside a pattern (title text, badge, icon) — not its own package | Inside a component or pattern |
| App chrome                      | **app frame** (not Shell)                                                            | `src/client/app-frame`        |
| Host                            | **Shell**                                                                            | `src/portal/app/*`            |

## Layers

| Layer         | Role                                                                                                | Location                       |
| ------------- | --------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Primitive** | shadcn/React Aria controls + variants (`Button`, `Dialog`, `Input`, …)                              | `ui-kit/components/ui`         |
| **Structure** | Form and layout shells (`FormFieldset`, `ListDetailLayout`, viewport hooks)                         | `ui-kit/form`, `ui-kit/layout` |
| **Composite** | Cross-feature interaction patterns (`ConfirmDialog`, `ActionSheet`, `ContextMenu`, `EmptyState`, …) | `ui-kit/composite`             |
| **Domain**    | Product-specific screens and fields                                                                 | `features/<slug>/ui`           |
| **app frame** | Module rail / tabs / settings host                                                                  | `client/app-frame`             |
| **Shell**     | Portal host, IPC, bridge                                                                            | `portal/app`                   |

Dependency direction: `app-frame` → `features/*/ui` → `{ui-kit, portal-sdk}` → shared. `ui-kit` must not import Habitat RPC / `rpc-contract`.

## Placement rules

1. If two features need the same interaction chassis, put the chassis in **composite** (or structure/layout); keep field copy and domain types in the feature.
2. Primitives stay dumb: variants and sizes, no feature imports.
3. Composites take **capability props** (e.g. `useActionSheet: boolean`) or call portal-sdk **interaction** hooks — they must not call `getShellKind()` to choose ContextMenu vs ActionSheet.
4. Layout structure components may use **layout** APIs (`useCompactLayout`, `useDrawerNav`, …).
5. Shell-only concerns stay in portal-sdk / shell host; ui-kit does not export shell detectors.

**Pending alignment:** Prefer `ListRow` (+ domain wrappers such as `TaskItemRowView`) for new list modules; align remaining custom rows to the **pattern contract** ([patterns.md](patterns.md)) — do not fork row behavior.

## Which layer may read which dimension

| Layer              | Shell APIs                                                        | Layout APIs                                    | Interaction APIs                                 |
| ------------------ | ----------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| Primitive          | No                                                                | No                                             | No (presentation only)                           |
| Structure / layout | No                                                                | Yes                                            | Rare (e.g. resize handles)                       |
| Composite          | Only via injected capability / portal-sdk helpers that hide shell | If the composite is a layout pattern           | Yes (menus, long-press, Enter-to-send consumers) |
| Domain             | Via portal-sdk when needed for capability UI                      | Yes for page chrome                            | Yes                                              |
| app frame          | Capability visibility                                             | Yes (primary)                                  | Yes where chrome needs it                        |
| Shell host         | Yes                                                               | Must not lock app layout from shell kind alone | Must not invent a parallel interaction model     |

## Primitive conventions (summary)

| Need           | Prefer                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------- |
| Button         | `<Button variant size>`                                                                      |
| Fields         | `<Input>` / `<Textarea>` / `<Select>`; no auto-focus by default (`focusOnMount` when needed) |
| Dialog / Sheet | React Aria default focus management; compose with Aria/shadcn Aria conventions (`isOpen`)    |
| Loading        | `<Spinner>`                                                                                  |
| Empty          | `<EmptyState>`                                                                               |
| Status         | `<StatusAlert>`                                                                              |
| Confirm        | `<ConfirmDialog>` / `showConfirm` — never `window.confirm`                                   |

Full agent checklist → [`.agent/rules/frontend-ui.md`](../../.agent/rules/frontend-ui.md).

## Dimension adaptation (components)

| Lens        | Rule                                                                                   |
| ----------- | -------------------------------------------------------------------------------------- |
| Invariant   | Layer placement and import boundaries                                                  |
| Layout      | Structure components switch List-Detail / Modal-Sheet presentation; domain fills slots |
| Interaction | Composites branch on capability flags; shared menu item data (`ActionSheetItem[]`)     |
| Shell       | Capability availability only; never “Tauri ⇒ bottom tabs”                              |
| Forbidden   | Deep-importing feature sources from app-frame; ui-kit importing RPC                    |

## Related

- Patterns → [patterns.md](patterns.md)
- Foundations → [foundations.md](foundations.md)
- Dimensions → [dimensions.md](dimensions.md)
