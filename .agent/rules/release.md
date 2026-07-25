# Versioning and Release

FreeAnima follows [Semantic Versioning 2.0.0](https://semver.org/) (`MAJOR.MINOR.PATCH`).
The **sole write source** is `"version"` in the root [`package.json`](../../package.json);
other workspace sub-package `package.json` files **do not** include a `version` field.
Runtime reads the root version via `ANIMA_VERSION` from `@freeanima/platform`.

Release is handled by **[Release Please](https://github.com/googleapis/release-please)** in GitHub Actions (see [`.github/workflows/release.yml`](../../.github/workflows/release.yml)).

## When to Bump Which Digit

Determined by **Conventional Commits**. Currently in **0.x.y initial development**, using 0.x convention: **x = breaking change, y = compatible feature/fix** (differs from post-1.0.0 MAJOR/MINOR/PATCH semantics).

| Commit                                             | Version digit  | Example           |
| -------------------------------------------------- | -------------- | ----------------- |
| `feat:`                                            | **PATCH (y)**  | `0.1.0` → `0.1.1` |
| `fix:` / `perf:` / `revert:`                       | **PATCH (y)**  | `0.1.1` → `0.1.2` |
| `BREAKING CHANGE:` or `feat!:`                     | **MINOR (x)**  | `0.1.2` → `0.2.0` |
| `chore:` / `docs:` / `refactor:` / `test:` / `ci:` | **No release** | —                 |

**1.0.0** is not auto-published on breaking commits; maintainers decide explicitly when API is stable (commit footer `Release-As: 1.0.0` or dedicated release).

Multiple commits in one Release PR merge into **one release**, taking highest bump (e.g. `fix` + `feat` → patch; `feat` + breaking → minor).

Release Please defaults to `feat` / `fix` / `deps` as releasable commit triggers for Release PR updates; `perf` / `revert` appear in changelog but alone may not open a Release PR (use `fix:` prefix or `Release-As` footer).

## Checking Version Day-to-Day

```bash
bun -p "require('./package.json').version"
# Or after build:
bun src/portal/cli/cli.ts -- --help
./dist/anima-executable/anima --version
# standalone install: anima service status
```

## Release Flow (Release PR)

1. Write **Conventional Commits** on feature branches (see below)
2. Merge PR to `main`（须通过 `Quality`；Blackbox `freeanima/blackbox` 已暂停，见 [`.github/SECRETS.md`](../../.github/SECRETS.md)）
3. `Release` workflow runs **release-please**: opens or updates a **Release PR** (label `autorelease: pending`), accumulating changelog and version bump since last tag
4. Release PR runs full CI; **maintainers decide when to release**, merge Release PR
5. After merge, same workflow: `release_created` → tag `vX.Y.Z`，create GitHub Release → **`package-artifacts`** 上传 Linux / Desktop / Mobile 三端产物

**Not** one release per `feat`; **one release when Release PR merges** (accumulating multiple commits).

### Commit Message Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer: BREAKING CHANGE: ...]
```

Common types: `feat`, `fix`, `perf`, `docs`, `chore`, `refactor`, `test`, `ci`, `build`, `revert`.

Local **`git commit` is enforced** (Husky `commit-msg` + [commitlint](https://commitlint.js.org/), config at root `commitlint.config.mjs`).

### Preview Next Version

On GitHub, inspect **Release PR** diff (`package.json` + `CHANGELOG.md`) for next version content and number.

Specify version in commit body with `Release-As: x.y.z` (see [Release Please docs](https://github.com/googleapis/release-please)).

### Version Manifest

[`.release-please-manifest.json`](../../.release-please-manifest.json) records current published version; must match latest `v*` tag and root `package.json`; auto-updated by Release Please after release.

## Packaged artifacts (Release + Canary)

正式 Release（`vX.Y.Z`）与 canary Pre-release **共用** [`.github/workflows/package-artifacts.yml`](../../.github/workflows/package-artifacts.yml)：在 **ubuntu-latest** 上构建并上传三端产物（Windows Desktop 为 Linux 交叉编译，不再使用 Windows runner）。

| 产物                   | 固定名（updater）                         | 版本化名（同目录另写一份）                                |
| ---------------------- | ----------------------------------------- | --------------------------------------------------------- |
| Linux standalone       | `anima-linux-x64.tar.gz`                  | `anima-linux-x64-{ver}-{channel}.tar.gz`                  |
| Desktop Windows NSIS   | `freeanima-desktop-windows-x64-setup.exe` | `freeanima-desktop-windows-x64-{ver}-{channel}-setup.exe` |
| Desktop Linux AppImage | `freeanima-desktop-tauri-linux.AppImage`  | `freeanima-desktop-tauri-linux-{ver}-{channel}.AppImage`  |
| Mobile Android APK     | `freeanima-mobile-android.apk`            | `freeanima-mobile-android-{ver}-{channel}.apk`            |

`just pack *` 经 [`pack-artifact-names.ts`](../../src/host/core/config/pack-artifact-names.ts) **双写**：版本化主名 + 固定别名（updater / 文档 curl）。`{ver}` 来自 `FREEANIMA_BUILD_VERSION` 或根 `package.json`（`+` → `.`）。本地未设 channel 时为 `dev`。

差异仅 **channel / 版本号 / 发布目标**：

| 轨          | Workflow                                                                      | 版本                                      | Tag                                 |
| ----------- | ----------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------- |
| **release** | [`release.yml`](../../.github/workflows/release.yml)（Release Please 合并后） | `FREEANIMA_BUILD_VERSION` = tag（去 `v`） | `vX.Y.Z`，`channel=release`         |
| **canary**  | [`canary.yml`](../../.github/workflows/canary.yml)（`main` push）             | `{nextVersion}-canary+{UTC YYYYMMDDHHmm}` | 滚动 tag `canary`，`channel=canary` |

Canary `nextVersion`：有 open Release PR（`autorelease: pending`）则取其 `package.json.version`，否则回退 [`.release-please-manifest.json`](../../.release-please-manifest.json)。Body 含 `sha: <full>`，供 canary 轨按 commit 检测更新。

手动重打：在 Actions 触发 [`canary.yml`](../../.github/workflows/canary.yml) 的 `workflow_dispatch`（可选 `ref`），走同一套 `package-artifacts`。

**Tauri 打包加速约定**（优先级：构建速度 > 体积 > 运行速度）：

- portal `[profile.release]`：`lto = false`、`codegen-units = 16`、`opt-level = 2`、`strip = true`（canary/release 共用）
- Linux 只打 AppImage、Windows 只打 NSIS（脚本 `--bundles`）
- 三端 job 均挂 `Swatinem/rust-cache`，**`key` 按平台区分**（`tauri-linux` / `tauri-windows-xwin` / `tauri-android`），避免并行覆盖
- Windows 交叉另缓存 `cargo-xwin` 与 `~/.xwin`

**本地构建默认 `channel=dev`**（未设 `FREEANIMA_BUILD_CHANNEL` 时）。CI 必须显式设置 `release` / `canary`。构建版本可用 `FREEANIMA_BUILD_VERSION` 覆盖（不改根 `package.json`）。

**分发轨（build-meta `channel`）**：`release` / `canary` / `dev`。`dev` **不可**换轨、不参与 GitHub 包更新；Desktop/Mobile 在 `dev` 下使用独立 appId（`com.freeanima.portal.dev`），避免覆盖正式安装（`com.freeanima.portal`）；壳默认 home 为 `~/.anima-dev`（正式轨 `~/.anima`，均可用 `FREEANIMA_HOME` 覆盖）。Standalone / Desktop / Mobile 在轨内检查更新；可在 `release`⇄`canary` 间切换。浏览器仅 PWA，不走 GitHub 包通道。

发布使用组织 secret **`FREEANIMA_CI`**。

## Linux standalone（本地）

After Release PR merge，`package-artifacts` 会执行 `just pack cli` 并打包上传。本地：

```bash
just pack cli   # 默认 channel=dev；CI 设 FREEANIMA_BUILD_CHANNEL
./dist/anima-executable/anima --version
```

**Runtime install modes:**

| Mode           | How to run                                               |
| -------------- | -------------------------------------------------------- |
| **source**     | `bun install` + `bun src/portal/cli/cli.ts` / `just dev` |
| **standalone** | Unpack Release tarball; run `./anima`                    |

There is **no** npm package publish and **no** Docker image publish.

## Prohibited

- Do not hardcode `X.Y.Z` in business code; use `import { ANIMA_VERSION } from "@freeanima/host/platform"` (or expose via health/status).
- Do not maintain `version` in workspace sub-package `package.json`.
- Do not manually edit `CHANGELOG.md` or `[Unreleased]`; release notes come from commits and Release Please.
- Do not run oxfmt on `CHANGELOG.md`; it is excluded in [`.oxfmtrc.jsonc`](../../.oxfmtrc.jsonc) `ignorePatterns`. Release Please writes `*` list markers (conventional-changelog default); do not convert them locally.

## Related Files

| File                                      | Role                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `package.json`                            | Sole version write source (updated by Release PR)                                        |
| `release-please-config.json`              | Release Please strategy and changelog sections                                           |
| `.release-please-manifest.json`           | Published version manifest                                                               |
| `.github/workflows/release.yml`           | release-please + 调用 package-artifacts                                                  |
| `.github/workflows/canary.yml`            | main 滚动 canary Pre-release；手动重打用 workflow_dispatch                               |
| `.github/workflows/package-artifacts.yml` | 共用三端打包（Linux / Desktop 交叉 / Mobile debug APK）                                  |
| `scripts/resolve-canary-version.ts`       | canary 版本串                                                                            |
| `scripts/build-cli-executable.ts`         | Standalone build                                                                         |
| `CHANGELOG.md`                            | New version section appended on Release PR merge; excluded from oxfmt (`*` list markers) |

## Repository Settings (Maintainers)

- Actions → General → **Allow GitHub Actions to create and approve pull requests**
- `FREEANIMA_CI` must be able to open PRs and trigger CI on Release PR (cannot substitute default `GITHUB_TOKEN`); Blackbox dispatch 已暂停（见 [`.github/SECRETS.md`](../../.github/SECRETS.md)）
