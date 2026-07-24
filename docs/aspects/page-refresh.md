---
title: Page refresh
---

# Page refresh (sync vs refresh)

> Parent aspect: [Portal data plane](portal-data-plane.md).

Outpost/Portal UI keeps data fresh with two distinct verbs. Do not conflate them with PWA / installer “reload”, which updates shell assets only.

## Verbs

| Verb        | When                                                           | What happens                                                                                                                   |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **sync**    | Habitat reconnect, tab visible again, Offline sync toast retry | Flush outbox; modules that flushed call `refreshAll` (see [offline platform](offline-platform.md))                             |
| **refresh** | Header **Refresh** button or touch pull-to-refresh             | Re-run the page’s `reload*` / list fetch (online `withOfflineCache` already network-fetches). Same handler for button and pull |

## Principles

- **Limited auto**: keep sync + existing live channels (chat `stream.*`, `conversation.updated`, `pomodoro.active.changed`). No global list polling. No unconditional `refreshAll` of every module on visibility when the outbox is empty.
- **Manual refresh required** on product list surfaces so multi-device / agent edits can be pulled on demand.
- **Interaction dimension** (see [ui-dimensions](../../.agent/rules/ui-dimensions.md)): pointer uses a header button; touch also gets pull-to-refresh on the primary list. Shell kind does not lock the affordance.
- **Out of scope**: Habitat fan-out for every CRUD entity; adopting the React Query **library** (self-owned hooks on the [Portal data plane](portal-data-plane.md) are fine); turning the offline-sync toast into a page refresh control.

## Page classes

| Class           | Pages                             | Auto                                                                   | Manual                                    |
| --------------- | --------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| A Stream        | Chat                              | SAP stream + recovery poll                                             | Header refresh (existing)                 |
| B CRUD outbox   | Task, Project, Diary              | Mount / selection cache-first; local write reload; sync → `refreshAll` | Header + pull-to-refresh                  |
| C Hybrid outbox | Pomodoro                          | `pomodoro.active.changed`                                              | Offline `refreshAll` for config/stats     |
| D snapshot      | Email, Notification, Dream, Vault | Mount / dependency load                                                | Header refresh (pull on list where bound) |
| E Habitat       | Ops lists                         | Load on enter                                                          | Explicit refresh (existing)               |
| F Settings      | Shell settings                    | Load on open                                                           | Re-read after save                        |
| G Shell update  | PWA / installer                   | Update check                                                           | Reload / install ≠ business refresh       |

## Implementation notes

- Shared pull gesture: `@freeanima/ui-kit/composite` `PullToRefresh` (touch-only; ignore starts near the left edge to avoid drawer swipe conflicts).
- Copy: `m.habitat_common_refresh` / `m.habitat_common_refreshing`.
- Follow-up (not required here): soft refresh of the focused module only on visibility with an empty outbox.
