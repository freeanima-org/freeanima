# Agent rules index

Detailed implementation constraints for AI agents working in this repository. Start with root [`AGENTS.md`](../../AGENTS.md), then open the files below as needed.

**Principle maintenance**: when correcting or refining implementation constraints or agent behavior norms, update the matching topic file in this directory in the same task/PR as code — do not leave changes code-only. Product / cognitive architecture principles belong in [`docs/product/`](../../docs/product/) and [`docs/cognition/`](../../docs/cognition/) instead. Full triage → [`AGENTS.md` § Principle & direction maintenance](../../AGENTS.md#principle--direction-maintenance).

| File                                               | When to read                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`coding.md`](coding.md)                           | Editing any TypeScript; tool handlers; types / Zod / ports; PG migrations                |
| [`drizzle-db.md`](drizzle-db.md)                   | `src/host/core/db/pg` repository queries; ORM vs `db.execute`; `$inferSelect` row typing |
| [`testing.md`](testing.md)                         | Adding or moving tests; mock strategy; CI tiers                                          |
| [`packages.md`](packages.md)                       | New workspace package or rename (RFC #1)                                                 |
| [`code-layers.md`](code-layers.md)                 | Six-layer deps, composition root, Registry injection                                     |
| [`repository-topology.md`](repository-topology.md) | Repo layout Phase 0 audit; shared/frontend migration; checker rewrite spec               |
| [`frontend-features.md`](frontend-features.md)     | 前端功能原型 A/B/C、Feature RPC vs Habitat 通道、新功能 touch 清单                       |
| [`frontend-ui.md`](frontend-ui.md)                 | DaisyUI 基元约定、`ui-kit/composite` 复合组件、Modal/空态规范                            |
| [`ui-dimensions.md`](ui-dimensions.md)             | 壳子/布局/交互三维度正交、API 映射、旧名→新名                                            |
| [`release.md`](release.md)                         | SemVer, Conventional Commits, Release Please, Linux standalone                           |
| [`tauri-shell.md`](tauri-shell.md)                 | Portal 壳（Tauri）：工程位置、禁止 Node sidecar、ShellApi、双轨发版                      |
| [`compression.md`](compression.md)                 | l-point compression algorithm and module entry points                                    |
| [`i18n.md`](i18n.md)                               | UI/docs i18n: Paraglide, po4a, PO workflow, site/Habitat message keys                    |
| [`docs-i18n.md`](docs-i18n.md)                     | AI rules for `docs/**` authoring and `po/zh_CN/*.po` msgstr                              |

**SSOT**: dependency boundaries → [`.agent/rules/code-layers.md`](code-layers.md)；import paths → `tsconfig.base.json` + `tsgo`；storage shapes → [`src/host/core/db/schema/`](../../src/host/core/db/schema/); port types and binding contracts → [`src/host/platform/ports/`](../../src/host/platform/ports/) (composition root imports `@freeanima/host/platform/ports`).

Product / cognitive architecture (four storage layers, tools, Gateway) → [`docs/product/architecture.md`](../../docs/product/architecture.md).
