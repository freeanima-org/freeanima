# 版本与发版

逸灵风采用 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)（`MAJOR.MINOR.PATCH`）。
**唯一写入源**是仓库根目录 [`package.json`](../package.json) 中的 `"version"`；
workspace 内其它 workspace 子包 `package.json` **不含** `version` 字段。
运行时通过 `@freeanima/service` 的 `ANIMA_VERSION` 读取根版本。

发版由 **[semantic-release](https://semantic-release.gitbook.io/)** 在 GitHub Actions 中自动完成（见 [`.github/workflows/release.yml`](../.github/workflows/release.yml)）。

## 何时 bump 哪一位

由 **Conventional Commits** 决定。当前处于 **0.x.y 初始开发阶段**，采用 0.x 约定：**x = 破坏性变更，y = 兼容新增/修复**（与 1.0.0 后的 MAJOR/MINOR/PATCH 语义不同）。

| Commit                                             | 版本位         | 示例              |
| -------------------------------------------------- | -------------- | ----------------- |
| `feat:`                                            | **PATCH（y）** | `0.1.0` → `0.1.1` |
| `fix:` / `perf:` / `revert:`                       | **PATCH（y）** | `0.1.1` → `0.1.2` |
| `BREAKING CHANGE:` 或 `feat!:`                     | **MINOR（x）** | `0.1.2` → `0.2.0` |
| `chore:` / `docs:` / `refactor:` / `test:` / `ci:` | **不发版**     | —                 |

**1.0.0** 不在 breaking commit 时自动发布；API 稳定后由维护者显式决定（例如专门 commit 或手动发版）。

同一 tag 区间内多个 commit 合并后 **只发一版**，取最高 bump（例如 `fix` + `feat` → patch；`feat` + breaking → minor）。

## 日常查看版本

```bash
bun -p "require('./package.json').version"
# 或已 build 后：
bun run anima -- service status   # 读 status 文件 / health API 中的 version
```

## 发版流程（自动）

1. 在 feature 分支用 **Conventional Commits** 写 commit message（见下）
2. PR 合并到 `main`
3. CI `Release` workflow：`typecheck` → `build` → `test` → `semantic-release`
4. 若有可发版 commit：bump 根 `package.json`、更新 `CHANGELOG.md` 顶部、打 `vX.Y.Z` tag、创建 GitHub Release、推送 `[skip ci]` 的 release commit

**不是**每个 `feat` 各发一版；是 **每次 merge 到 main 后至多发一版**（自上次 tag 以来有可发版 commit 时）。

### Commit message 格式

```
<type>(<scope>): <subject>

[optional body]

[optional footer: BREAKING CHANGE: ...]
```

常用 type：`feat`、`fix`、`perf`、`docs`、`chore`、`refactor`、`test`、`ci`、`build`、`revert`。

本地 **`git commit` 会强制校验**（Husky `commit-msg` + [commitlint](https://commitlint.js.org/)，配置见根目录 `commitlint.config.mjs`）。格式不符时提交会被拒绝；可用 `HUSKY=0 git commit …` 临时跳过（semantic-release 的 release commit 在 CI 中已设 `HUSKY=0`）。

示例：

```
feat(gateway): Discord 子线程续聊复用 session
fix(cron): run 接口改为异步 enqueue
feat(api)!: 移除非 SSE 发消息端点

BREAKING CHANGE: POST /api/sessions/:id/messages 已删除
```

### 本地预览（可选）

```bash
HUSKY=0 bun run release:dry-run
```

需要完整 git 历史（`fetch-depth: 0`）；本地无 `GITHUB_TOKEN` 时会在 GitHub Release 步骤前停止，仍可看算出的版本与 changelog 草稿。

### 一次性基线 tag（接入后首次必做）

若仓库尚无 `v*` tag，semantic-release 会把 **全部历史 commit** 纳入计算，版本可能从 `0.1.0` 起跳而非当前 `package.json` 版本。

在 `main` 上对齐当前版本（仅需一次）：

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

之后仅 **tag 之后** 的可发版 commit 会触发新版本。

## 禁止事项

- 不要在业务代码中硬编码 `X.Y.Z`；统一 `import { ANIMA_VERSION } from "@freeanima/service"`（或经 health/status 暴露）。
- 不要在 workspace 子包 `package.json` 中维护 `version`。
- 不要手改 `[Unreleased]` 或本地 `bun run release patch`（已废弃）；发布说明来自 commit，不是手写 CHANGELOG 节。

## 相关文件

| 文件                                     | 作用                        |
| ---------------------------------------- | --------------------------- |
| `package.json`                           | 版本唯一写入源（CI 更新）   |
| `.releaserc.json`                        | semantic-release 插件配置   |
| `.github/workflows/release.yml`          | 发版 CI                     |
| `service/service/src/runtime/version.ts` | 运行时读取根版本            |
| `CHANGELOG.md`                           | 自动追加新版本节 + 历史条目 |
