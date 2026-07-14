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
bun run anima -- service status   # reads version from status file / health API
./dist/anima-executable/anima --version
```

## Release Flow (Release PR)

1. Write **Conventional Commits** on feature branches (see below)
2. Merge PR to `main`（须通过 `Quality`；Blackbox `freeanima/blackbox` 已暂停，见 [`.github/SECRETS.md`](../../.github/SECRETS.md)）
3. `Release` workflow runs **release-please**: opens or updates a **Release PR** (label `autorelease: pending`), accumulating changelog and version bump since last tag
4. Release PR runs full CI; **maintainers decide when to release**, merge Release PR
5. After merge, same workflow: `release_created` → tag `vX.Y.Z`, create GitHub Release → **`build:cli:executable`** → upload `anima-linux-x64.tar.gz`

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

## Linux standalone artifact (sole distribution)

After Release PR merge and `release_created`:

1. **`bun run build:cli:executable`** — produces `dist/anima-executable/` (`anima` binary with embedded migrations + Web dist, plus install-prefix `package.json` / `dist/build-meta.json`)
2. Pack `anima-linux-x64.tar.gz` and upload to the GitHub Release for tag `vX.Y.Z`

**Runtime install modes:**

| Mode           | How to run                                                 |
| -------------- | ---------------------------------------------------------- |
| **source**     | `bun install` + `bun run link:global` (or `bun run anima`) |
| **standalone** | Unpack Release tarball; run `./anima`                      |

There is **no** npm package publish and **no** Docker image publish.

Local rebuild:

```bash
bun run build:cli:executable
./dist/anima-executable/anima --version
```

## Prohibited

- Do not hardcode `X.Y.Z` in business code; use `import { ANIMA_VERSION } from "@freeanima/platform"` (or expose via health/status).
- Do not maintain `version` in workspace sub-package `package.json`.
- Do not manually edit `CHANGELOG.md` or `[Unreleased]`; release notes come from commits and Release Please.
- Do not run oxfmt on `CHANGELOG.md`; it is excluded in [`.oxfmtrc.jsonc`](../../.oxfmtrc.jsonc) `ignorePatterns`. Release Please writes `*` list markers (conventional-changelog default); do not convert them locally.

## Related Files

| File                              | Role                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `package.json`                    | Sole version write source (updated by Release PR)                                        |
| `release-please-config.json`      | Release Please strategy and changelog sections                                           |
| `.release-please-manifest.json`   | Published version manifest                                                               |
| `.github/workflows/release.yml`   | release-please + Linux standalone upload                                                 |
| `scripts/build-cli-executable.ts` | Standalone build                                                                         |
| `CHANGELOG.md`                    | New version section appended on Release PR merge; excluded from oxfmt (`*` list markers) |

## Repository Settings (Maintainers)

- Actions → General → **Allow GitHub Actions to create and approve pull requests**
- `FREEANIMA_CI` must be able to open PRs and trigger CI on Release PR (cannot substitute default `GITHUB_TOKEN`); Blackbox dispatch 已暂停（见 [`.github/SECRETS.md`](../../.github/SECRETS.md)）
