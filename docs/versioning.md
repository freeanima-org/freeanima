---
title: Versioning
---

# 版本与发版

逸灵风采用 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)（`MAJOR.MINOR.PATCH`）。
**唯一写入源**是仓库根目录 [`package.json`](../package.json) 中的 `"version"`；
workspace 内其它 workspace 子包 `package.json` **不含** `version` 字段。
运行时通过 `@freeanima/service` 的 `ANIMA_VERSION` 读取根版本。

发版由 **[Release Please](https://github.com/googleapis/release-please)** 在 GitHub Actions 中完成（见 [`.github/workflows/release.yml`](../.github/workflows/release.yml)）。

## 何时 bump 哪一位

由 **Conventional Commits** 决定。当前处于 **0.x.y 初始开发阶段**，采用 0.x 约定：**x = 破坏性变更，y = 兼容新增/修复**（与 1.0.0 后的 MAJOR/MINOR/PATCH 语义不同）。

| Commit                                             | 版本位         | 示例              |
| -------------------------------------------------- | -------------- | ----------------- |
| `feat:`                                            | **PATCH（y）** | `0.1.0` → `0.1.1` |
| `fix:` / `perf:` / `revert:`                       | **PATCH（y）** | `0.1.1` → `0.1.2` |
| `BREAKING CHANGE:` 或 `feat!:`                     | **MINOR（x）** | `0.1.2` → `0.2.0` |
| `chore:` / `docs:` / `refactor:` / `test:` / `ci:` | **不发版**     | —                 |

**1.0.0** 不在 breaking commit 时自动发布；API 稳定后由维护者显式决定（commit footer `Release-As: 1.0.0` 或专门发版）。

同一 Release PR 内多个 commit 合并后 **只发一版**，取最高 bump（例如 `fix` + `feat` → patch；`feat` + breaking → minor）。

Release Please 默认以 `feat` / `fix` / `deps` 作为可发版 commit 触发 Release PR 更新；`perf` / `revert` 会出现在 changelog 中，但单独提交时可能不会开 Release PR（可用 `fix:` 前缀或 `Release-As` footer）。

## 日常查看版本

```bash
bun -p "require('./package.json').version"
# 或已 build 后：
bun run anima -- service status   # 读 status 文件 / health API 中的 version
```

## 发版流程（Release PR）

1. 在 feature 分支用 **Conventional Commits** 写 commit message（见下）
2. PR 合并到 `main`（须过 `Quality` + `freeanima/blackbox`）
3. `Release` workflow 运行 **release-please**：开或更新一条 **Release PR**（label `autorelease: pending`），累积自上次 tag 以来的 changelog 与版本 bump
4. Release PR 同样跑完整 CI；**维护者决定何时发版**，merge Release PR
5. merge 后同次 workflow：`release_created` → 打 `vX.Y.Z` tag、创建 GitHub Release → `build:cli` + `publish-cli.sh`（npm OIDC）
6. push `v*` tag 触发 [`.github/workflows/release-docker.yml`](../.github/workflows/release-docker.yml)

**不是**每个 `feat` 各发一版；是 **merge Release PR 时发一版**（PR 内累积多个 commit）。

### Commit message 格式

```
<type>(<scope>): <subject>

[optional body]

[optional footer: BREAKING CHANGE: ...]
```

常用 type：`feat`、`fix`、`perf`、`docs`、`chore`、`refactor`、`test`、`ci`、`build`、`revert`。

本地 **`git commit` 会强制校验**（Husky `commit-msg` + [commitlint](https://commitlint.js.org/)，配置见根目录 `commitlint.config.mjs`）。

示例：

```
feat(gateway): Discord 子线程续聊复用 session
fix(cron): run 接口改为异步 enqueue
feat(api)!: 移除非 SSE 发消息端点

BREAKING CHANGE: POST /api/sessions/:id/messages 已删除
```

### 预览下一版

在 GitHub 上查看 **Release PR** 的 diff（`package.json` + `CHANGELOG.md`），即下一版内容与版本号。

指定版本可在 commit body 写 `Release-As: x.y.z`（见 [Release Please 文档](https://github.com/googleapis/release-please)）。

### 版本 manifest

[`.release-please-manifest.json`](../.release-please-manifest.json) 记录当前已发布版本，须与最新 `v*` tag 及根 `package.json` 一致；由 Release Please 在发版后自动更新。

## Bun 全局包与 Docker 镜像

Release PR merge 且 `release_created` 后：

1. **`bun run build:cli`** — 产出 `cli/publish/`（`@freeanima/cli` tarball 内容）
2. **`scripts/publish-cli.sh`** — `npm publish` + GitHub Actions OIDC（npm CLI ≥ 11.5.1）；本地手动发包用 `bun run publish:cli`（需 `npm login`）
3. **Docker 镜像** — push `v*` tag 时由 [`.github/workflows/release-docker.yml`](../.github/workflows/release-docker.yml) 构建并推送到 `ghcr.io/freeanima-org/freeanima:latest` 与 `:vX.Y.Z`

### npm Trusted Publishing（唯一 CI 发布路径）

在 [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers#for-github-actions) 为 `@freeanima/cli` 配置 GitHub Actions：

| 字段                 | 值              |
| -------------------- | --------------- |
| Organization or user | `freeanima-org` |
| Repository           | `freeanima`     |
| Workflow filename    | `release.yml`   |
| Allowed actions      | `npm publish`   |

Release workflow 的 `publish` job 已设 `id-token: write`；发布用 `bunx npm@11 publish`（勿用 `setup-node` 的 `registry-url`，会阻断 OIDC）。`cli/publish/package.json` 的 `publishConfig.registry` 须为 `https://registry.npmjs.org/`（含尾斜杠）。

验证通过后，可在包 Settings → Publishing access 选 **disallow tokens**，仅保留 OIDC 发布。

本地安装发布包（开发调试）：

```bash
bun run build:cli
bun install -g ./cli/publish
anima service start --foreground
```

Docker Compose 快速体验：

```bash
cp .env.example .env   # 填写 PG_PASSWORD、OPENAI_API_KEY
docker compose up --build
```

## 禁止事项

- 不要在业务代码中硬编码 `X.Y.Z`；统一 `import { ANIMA_VERSION } from "@freeanima/service"`（或经 health/status 暴露）。
- 不要在 workspace 子包 `package.json` 中维护 `version`。
- 不要手改 `CHANGELOG.md` 或 `[Unreleased]`；发布说明来自 commit 与 Release Please。

## 相关文件

| 文件                                     | 作用                               |
| ---------------------------------------- | ---------------------------------- |
| `package.json`                           | 版本唯一写入源（Release PR 更新）  |
| `release-please-config.json`             | Release Please 策略与 changelog 节 |
| `.release-please-manifest.json`          | 已发布版本 manifest                |
| `.github/workflows/release.yml`          | release-please + npm publish       |
| `.github/workflows/release-docker.yml`   | Docker 镜像推 GHCR                 |
| `service/service/src/runtime/version.ts` | 运行时读取根版本                   |
| `CHANGELOG.md`                           | Release PR 合并时追加新版本节      |

## 仓库 Settings（维护者）

- Actions → General → **Allow GitHub Actions to create and approve pull requests**
- `RELEASE_PAT` 须能开 PR 并触发 Release PR 上的 CI（不能用默认 `GITHUB_TOKEN` 替代）
