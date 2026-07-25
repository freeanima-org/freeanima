---
title: UI / UX
---

# UI / UX

Product design system for FreeAnima Portal UI: **visual foundations**, **component taxonomy**, and **interaction patterns**. All three adapt through the same orthogonal axes — **shell**, **layout**, and **interaction** — defined in [dimensions](dimensions.md).

This directory is the **UI/UX specification SSOT**. Agent hard bans, import rules, and API entry paths live in [`.agent/rules/`](../../.agent/rules/README.md) and link here. Token values live in code (`src/ui-kit/styles/globals.css`). When code and docs disagree, **code wins**.

## Reading order

1. [dimensions.md](dimensions.md) — shell / layout / interaction; Shell vs app frame
2. [foundations.md](foundations.md) — color, type, space, radius, elevation, motion, focus, …
3. [components.md](components.md) — primitive / structure / composite / domain; placement rules
4. [patterns.md](patterns.md) — reusable interaction patterns (e.g. DataListRow)

## Division of responsibility

| Layer                           | Owns                                                          | Does not own                      |
| ------------------------------- | ------------------------------------------------------------- | --------------------------------- |
| `docs/ui/`                      | Product-facing norms, pattern contracts, dimension adaptation | IDE checklists, weekly tool lists |
| `.agent/rules/ui-dimensions.md` | Hard bans + API quick reference                               | Long product essays               |
| `.agent/rules/frontend-ui.md`   | Stack bans, import boundaries, composite import list          | Full visual essays                |
| `src/ui-kit/`                   | Components + CSS tokens (implementation SSOT)                 | Product architecture              |
| `docs/aspects/`                 | Cross-cutting data planes (sync, refresh, offline)            | Visual taxonomy                   |

Feature archetypes and package touch lists → [`.agent/rules/frontend-features.md`](../../.agent/rules/frontend-features.md).

## Adoption

- **New UI** must follow this corpus (and the linked agent rules).
- **Existing UI** may diverge; gaps are marked **pending alignment** in the topic docs. Fix them in follow-up tasks — do not weaken the spec to match forks.

## Related

- Product architecture (stack map) → [product/architecture.md](../product/architecture.md)
- Page sync vs refresh → [aspects/page-refresh.md](../aspects/page-refresh.md)
- Glossary (Shell, app frame, …) → [i18n/glossary.md](../../i18n/glossary.md)
