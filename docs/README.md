---
title: Documentation Index
---

# docs/

For **FreeAnima users** and the Habitat agent (`freeanima_docs` ToolSet). Contributor rules: [`.agent/rules/`](../.agent/rules/README.md). Tasks: [GitHub Issues](https://github.com/freeanima-org/freeanima/issues).

**Agent tip:** `toolset_load(["freeanima_docs"])` then prefer `freeanima_docs_get` on `README.md`, or `freeanima_docs_list` with a path `prefix` (`product/`, `cognition/`, `ui/`, `aspects/`, `modules/`, `tools/`, `ops/`).

## Product — framing and data model

| Topic        | File                                               |
| ------------ | -------------------------------------------------- |
| Architecture | [product/architecture.md](product/architecture.md) |
| Identity     | [product/identity.md](product/identity.md)         |
| Entity model | [product/entity-model.md](product/entity-model.md) |
| Anima URI    | [product/anima-uri.md](product/anima-uri.md)       |

## Cognition — how the digital life thinks

| Topic                 | File                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| Memory                | [cognition/memory.md](cognition/memory.md)                               |
| Compression           | [cognition/compression.md](cognition/compression.md)                     |
| Sleep                 | [cognition/sleep.md](cognition/sleep.md)                                 |
| Dream                 | [cognition/dream.md](cognition/dream.md)                                 |
| Self layer            | [cognition/self-layer.md](cognition/self-layer.md)                       |
| Time perception       | [cognition/time-perception.md](cognition/time-perception.md)             |
| Temporal summary      | [cognition/temporal-summary.md](cognition/temporal-summary.md)           |
| Recall flow           | [cognition/recall-flow.md](cognition/recall-flow.md)                     |
| Environment awareness | [cognition/environment-awareness.md](cognition/environment-awareness.md) |
| Notifications         | [cognition/notifications.md](cognition/notifications.md)                 |

## UI / UX — design system

| Topic                | File                                   |
| -------------------- | -------------------------------------- |
| Index                | [ui/README.md](ui/README.md)           |
| Dimensions           | [ui/dimensions.md](ui/dimensions.md)   |
| Visual foundations   | [ui/foundations.md](ui/foundations.md) |
| Components           | [ui/components.md](ui/components.md)   |
| Interaction patterns | [ui/patterns.md](ui/patterns.md)       |

Agent hard bans / API quick reference → [`.agent/rules/frontend-ui.md`](../.agent/rules/frontend-ui.md), [`.agent/rules/ui-dimensions.md`](../.agent/rules/ui-dimensions.md).

## Aspects — cross-cutting design planes

| Topic             | File                                                         |
| ----------------- | ------------------------------------------------------------ |
| Portal data plane | [aspects/portal-data-plane.md](aspects/portal-data-plane.md) |
| Offline platform  | [aspects/offline-platform.md](aspects/offline-platform.md)   |
| Page refresh      | [aspects/page-refresh.md](aspects/page-refresh.md)           |
| Entity revisions  | [aspects/entity-revisions.md](aspects/entity-revisions.md)   |

## Modules — product capabilities

| Topic             | File                                           |
| ----------------- | ---------------------------------------------- |
| Chat              | [modules/chat.md](modules/chat.md)             |
| Desktop companion | [modules/companion.md](modules/companion.md)   |
| Diary             | [modules/diary.md](modules/diary.md)           |
| Session goal      | [modules/goal.md](modules/goal.md)             |
| Project           | [modules/project.md](modules/project.md)       |
| Mobile app        | [modules/mobile-app.md](modules/mobile-app.md) |

## Tools — built-in ToolSets

| Topic           | File                                               |
| --------------- | -------------------------------------------------- |
| freeanima_docs  | [tools/freeanima-docs.md](tools/freeanima-docs.md) |
| Code runtimes   | [tools/execute-code.md](tools/execute-code.md)     |
| Camofox browser | [tools/browser.md](tools/browser.md)               |

## Ops — deploy, secure, connect

| Topic           | File                                             |
| --------------- | ------------------------------------------------ |
| Installation    | [ops/install.md](ops/install.md)                 |
| Service         | [ops/service.md](ops/service.md)                 |
| Security        | [ops/security.md](ops/security.md)               |
| Database        | [ops/database.md](ops/database.md)               |
| Remote access   | [ops/remote-access.md](ops/remote-access.md)     |
| Habitat RPC     | [ops/habitat-rpc.md](ops/habitat-rpc.md)         |
| Message gateway | [ops/message-gateway.md](ops/message-gateway.md) |
