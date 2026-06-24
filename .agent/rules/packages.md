# Package naming (RFC #1)

Workspace package names reflect the five-layer model:

| Shape           | Pattern                          | Example                                       |
| --------------- | -------------------------------- | --------------------------------------------- |
| Layer aggregate | `@freeanima/{layer}`             | `kernel`, `core`, `runtime`, `platform`       |
| Capability pack | `@freeanima/capabilities-{slug}` | `capabilities-memory`, `capabilities-tools`   |
| Entry           | `@freeanima/cli`                 | CLI only                                      |
| Shell UI        | `@freeanima/shell-ui`            | 桌面/移动统一壳层 SPA（`packages/shell-ui/`） |

## Valid layer packages

| Package               | Layer        | Notes                                           |
| --------------------- | ------------ | ----------------------------------------------- |
| `@freeanima/kernel`   | kernel       | subpaths: `/logging`, `/hooks`, `/eventbus`     |
| `@freeanima/core`     | core         | subpaths: `/db`, `/repos`, `/tool`, `/llm`, …   |
| `@freeanima/runtime`  | runtime      | subpaths: `/session`, `/turn`, `/loop`, …       |
| `@freeanima/platform` | platform     | subpaths: `/ports`, `/config`, `/connectors/*`  |
| `capabilities-*`      | capabilities | 7 packs; see [`code-layers.md`](code-layers.md) |
| `@freeanima/cli`      | entry        | documented only                                 |

**Deprecated prefixes** (must not appear in new packages): `engine-*`, `life-*`, `storage-*`, `mechanism-*`, `orchestration-*`, `service-*`, `connectors-*`.

Layer dependency rules: [`code-layers.md`](code-layers.md).
