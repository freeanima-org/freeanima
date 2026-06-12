# Package naming (RFC #1)

New-stack workspace package names **prefix with layer name**:

| Shape                | Pattern                            | Example                                                         |
| -------------------- | ---------------------------------- | --------------------------------------------------------------- |
| Layer aggregate      | `@freeanima/{layer}`               | `kernel`, `orchestration-runtime`                               |
| Layer component      | `@freeanima/{layer}-{slug}`        | `storage-db`, `mechanism-tool`（kernel 已合并为单包 + subpath） |
| Layer implementation | `@freeanima/{layer}-{slug}-{impl}` | `connectors-eventbus-redis`                                     |

## Valid layer prefixes

| Prefix            | Layer         | Notes                                                                                   |
| ----------------- | ------------- | --------------------------------------------------------------------------------------- |
| `kernel-*`        | kernel        | 历史前缀；新代码统一 `@freeanima/kernel` + subpath（`/logging`、`/hooks`、`/eventbus`） |
| `storage-*`       | storage       | replaces deprecated `engine-db`, `engine-config`, …                                     |
| `mechanism-*`     | mechanism     | replaces deprecated `engine-tool`, `engine-llm`, …                                      |
| `orchestration-*` | orchestration | replaces deprecated `engine-loop`, `engine`, …                                          |
| `capabilities-*`  | capabilities  | includes `capabilities-identity`, `capabilities-memory` (formerly `life-*`)             |
| `connectors-*`    | connectors    |                                                                                         |
| `service-*`       | service       | includes `service-commands` (formerly `connectors-commands`)                            |
| `cli`             | entry         | documented only; not a npm prefix pattern                                               |

**Deprecated prefixes** (must not appear in new packages): `engine-*`, `life-*`, `connectors-commands`.

- Compound slugs without inner hyphens (`eventbus`, not `event-bus`)
- Hook / EventTopic `qualifiedId` is independent of npm package name

Layer dependency rules and historical rename table: [`code-layers.md`](code-layers.md).
