# AGENTS.md — FreeAnima 仓库工作指南

本文件是 agent 入职文档的 canonical；代码是 SSOT。专题细则（编码规范、拓扑、发布、测试等）在
`.cursor/rules/*.mdc`：Cursor 会按 globs 自动注入，其他客户端（OpenCode 等）需要时直接读对应 mdc；
mdc 只放本文件未覆盖的 delta，此处不重复细节。

## 命令

前置：Bun ≥ 1.4.2（根 `packageManager`）；`just` 需 bash（Windows 用 Git Bash，见
`docs/ops/windows-dev.md`）；仓库带 `flake.nix` + `.envrc`，`nix develop` / direnv 可拉起完整 devShell。
业务入口一律走 `just`（根 `package.json` 只剩 husky `prepare`，**不要** `bun run`）；列全部：`just --list`。

| 用途                                     | 命令                                                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 安装依赖                                 | `bun install`（每个 just 配方已内置 `bun install --frozen-lockfile`，无需先手动装）                             |
| 开发（Habitat 随机 ≥10000 + Vite :5000） | `just dev`；单项：`just dev habitat` / `just dev web` / `just dev tauri`                                        |
| PR 前门禁                                | `just check`（typecheck + oxlint + stylelint + fmt + 变更单测 + 一批 `scripts/check-*.ts` 架构护栏；≠ 全量 CI） |
| 测试                                     | `just qa test-unit` / `test-changed` / `test-unit-core`；集成：`just qa test-integration -- --core`             |
| lint / format / typecheck                | `just qa lint`（`lint-fix`）；`just fmt`（`just qa fmt-check`）；`just qa typecheck`                            |
| 构建                                     | `just pack web` / `cli`（Linux standalone）/ `tauri` / `tauri-windows` / `browser-extension-chrome`             |
| 数据库                                   | `just db generate` / `just db migrate`（需 `DATABASE_URL`）；改表后 `just db shapes`                            |

提交前顺序（husky 链，勿 `--no-verify`，钩子失败要新建 commit 而不是 amend）：
`git commit` → `commit-msg` 跑 commitlint → `pre-commit` 跑 `just qa pre-commit`
（tsc → oxlint → oxfmt --check → check-package-paths → check-external-deps → 变更 unit）→ push →
`pre-push` 只跑 unit CORE（`just qa pre-push`）。全量集成只在 CI 与手动 `just qa test-integration`。

## 布局

Bun workspaces monorepo：`packages/*` + `site`，13 个运行时包 + 文档站——包职责矩阵、import
前缀、tsconfig paths、废弃前缀清单见 `.cursor/rules/repository-topology.mdc`（勿在本文件复制）。
速记：`shared`（契约/Zod）→ `kernel` → `core`（drizzle schema + PG/Redis）→ `engine` →
`capabilities` → `features`（服务端特性）→ `server`（组合根）；前端 `ui-kit` / `portal-sdk` /
`ui-features` / `app-frame` / `portal`（`app/{web,tauri}` + 浏览器扩展）；`cli` 提供 `anima` 等。

- `scripts/`：dev / build / check-* 真实实现，just 配方只是包装；`tests/`：仅跨包集成测试，
  单测永远就近 `packages/**/*.test.ts`（`bun:test`），分层见 `tests/README.md`
- `docs/`（索引 `docs/README.md`）、`site/`（Astro 文档站，`cd site && bun run build`）

生成物（勿手改）：`packages/shared/pg-shapes/rows/*.gen.ts`（`just db shapes`）、
`packages/core/migrations/*`（`just db generate` 产物，含 snapshot.json）、`CHANGELOG.md`
（release-please）。构建输出 gitignore：`dist*/`、`coverage/`、`.wxt/`、`src-tauri/{target,gen,ui}`。
例外：`packages/portal/app/web/dist/` 的空占位目录必须留仓（`dir:` 护栏要求）。

## 约定

linter 管不到的：

- 提交：Conventional Commits，subject 可中文；type 限 `feat|fix|perf|docs|chore|refactor|test|ci|build|revert`
  （`commitlint.config.mjs`，与 release-please 配置对齐）
- 分支与合并：功能分支开发；本仓**仅 rebase merge**，禁 squash、禁 force-push `main`；PR 正文中文，
  关联 issue 写 `closes #N`；流程细则见 `.opencode/skills/freeanima-pr-and-deploy-canary/`
- 版本：唯一版本写在根 `package.json`（子包无 version 字段）；0.x 期间 breaking→x、feat/fix→y；
  发布走 Release PR（label `autorelease: pending`），产物三端 + canary 滚动轨——见 `.cursor/rules/release.mdc`
- 文案：无 i18n 运行时，UI / 用户可见串 / `docs/**` 直接简体中文；禁止再引入 i18n 框架
- 冲突优先级：代码 > `docs/product/architecture.md` > GitHub Issues > 过时规划
- 密钥：只走 env / pass / Vault，不进 `config.yaml` 与 git；镜像源只放用户级 `~/.bunfig.toml`，
  `bun.lock` 里禁止出现镜像 URL（Bun 会把绝对 tarball 地址写进 lock）
- 原则 / 约束变更须与代码同 PR 落盘（写入位置表见 `.cursor/rules/agent-bootstrap.mdc`）

## 坑

只列有出处、可复核的：

- **2026-07**：Blackbox E2E dispatch 已暂停（`ci.yml` `blackbox-dispatch` `if: false`），PR 不等
  `freeanima/blackbox` 检查；恢复方式与 Dependabot secret 限制见 `.github/SECRETS.md`
- **2026-06/07（v0.8.0 → v0.9.1）**：多 worktree 开发经 symlink 复用根 `node_modules`，`just dev`
  默认随机端口正是为此；并行时显式 `HABITAT_PORT` / `WEB_DEV_PORT`（`scripts/dev.ts`）。
  源码树 CLI **没有** `anima service` 子命令——那是 standalone 安装专用
- **Windows/WSL bash 抢 PATH**（长期，`docs/ops/windows-dev.md`）：`System32\bash.exe`（WSL）排到
  Git Bash 前面时，`just` 报 `bun: command not found`；Justfile 在 Windows 统一调 `bun.exe`，
  本地 CLI 一律 `bun x`——勿写裸 `bunx`（WSL bash 下常 127）
- **旧 scoop Bun**：缺 `Bun.YAML` / `vi.useFakeTimers` 会让单测大面积失败，先 `scoop update bun`
- **web_search / web_extract 全部经 Firecrawl**（`packages/capabilities/tools/web.ts`）：未配置时
  工具返回 "Firecrawl not configured" 而非静默降级；默认官方 `https://api.firecrawl.dev`，
  自建实例走 runtime 配置 `firecrawl.api_url`（key 走 env/Vault）
- **集成测试 PG**：`ANIMA_TEST_PG_URL` 禁止指日常 `config.yaml` 同 host:port（护栏直接 throw）；
  本机无 Docker 时 PG 用例会跳过——别把"全过"当成集成覆盖的证据

## 计划 / 任务

- 功能与 bug 跟踪在 GitHub Issues（`freeanima-org/freeanima`），PR 用 `closes #N` 关联
- 仓内「风巢 #N」引用 = 个人 FreeAnima 实例的 entity 任务（task_item），读写经 MCP
  `freeanima-fengnest-prod`；按风巢任务做功能验收流程见 `.cursor/skills/auto-accept/SKILL.md`
- 下一版本内容与发布状态看 open Release PR 的 diff（`package.json` + `CHANGELOG.md`），
  不要在本文件或 docs 里维护任务清单
- canary 轨 = `main` 滚动 pre-release（`canary.yml`，可 workflow_dispatch 重打）；
  部署目标机等运维细节不进本文件
