---
title: Versioning
---

# Versioning and Release

FreeAnima follows [Semantic Versioning 2.0.0](https://semver.org/) (`MAJOR.MINOR.PATCH`).
The **sole write source** is `"version"` in the root [`package.json`](../../package.json);
other workspace sub-package `package.json` files **do not** include a `version` field.
Runtime reads the root version via `ANIMA_VERSION` from `@freeanima/service`.

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
```

## Release Flow (Release PR)

1. Write **Conventional Commits** on feature branches (see below)
2. Merge PR to `main` (must pass `Quality` + `freeanima/blackbox`)
3. `Release` workflow runs **release-please**: opens or updates a **Release PR** (label `autorelease: pending`), accumulating changelog and version bump since last tag
4. Release PR runs full CI; **maintainers decide when to release**, merge Release PR
5. After merge, same workflow: `release_created` → tag `vX.Y.Z`, create GitHub Release → `build:cli` + `publish-cli.sh` (npm OIDC)
6. Push `v*` tag triggers [`.github/workflows/release-docker.yml`](../../.github/workflows/release-docker.yml)

**Not** one release per `feat`; **one release when Release PR merges** (accumulating multiple commits).

### Commit Message Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer: BREAKING CHANGE: ...]
```

Common types: `feat`, `fix`, `perf`, `docs`, `chore`, `refactor`, `test`, `ci`, `build`, `revert`.

Local **`git commit` is enforced** (Husky `commit-msg` + [commitlint](https://commitlint.js.org/), config at root `commitlint.config.mjs`).

Examples:

```
feat(gateway): Discord thread continuation reuses session
fix(cron): run endpoint changed to async enqueue
feat(api)!: remove non-SSE message endpoint

BREAKING CHANGE: POST /api/sessions/:id/messages removed
```

### Preview Next Version

On GitHub, inspect **Release PR** diff (`package.json` + `CHANGELOG.md`) for next version content and number.

Specify version in commit body with `Release-As: x.y.z` (see [Release Please docs](https://github.com/googleapis/release-please)).

### Version Manifest

[`.release-please-manifest.json`](../../.release-please-manifest.json) records current published version; must match latest `v*` tag and root `package.json`; auto-updated by Release Please after release.

## Bun Global Package and Docker Image

After Release PR merge and `release_created`:

1. **`bun run build:cli`** — produces `cli/publish/` (`@freeanima/cli` tarball contents)
2. **`scripts/publish-cli.sh`** — `npm publish` + GitHub Actions OIDC (npm CLI ≥ 11.5.1); local manual publish: `bun run publish:cli` (requires `npm login`)
3. **Docker image** — on `v*` tag push, [`.github/workflows/release-docker.yml`](../../.github/workflows/release-docker.yml) builds and pushes to `ghcr.io/freeanima-org/freeanima:latest` and `:vX.Y.Z`

### npm Trusted Publishing (Sole CI Publish Path)

Configure GitHub Actions in [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers#for-github-actions) for `@freeanima/cli`:

| Field                | Value           |
| -------------------- | --------------- |
| Organization or user | `freeanima-org` |
| Repository           | `freeanima`     |
| Workflow filename    | `release.yml`   |
| Allowed actions      | `npm publish`   |

Release workflow `publish` job has `id-token: write`; publish with `bunx npm@11 publish` (do not use `setup-node` `registry-url`, blocks OIDC). `cli/publish/package.json` `publishConfig.registry` must be `https://registry.npmjs.org/` (trailing slash).

After verification, package Settings → Publishing access can **disallow tokens**, OIDC-only publish.

Local install of published package (dev debugging):

```bash
bun run build:cli
bun install -g ./cli/publish
anima service start --foreground
```

Docker Compose quick start:

```bash
cp .env.example .env   # fill PG_PASSWORD, OPENAI_API_KEY
docker compose up --build
```

## Prohibited

- Do not hardcode `X.Y.Z` in business code; use `import { ANIMA_VERSION } from "@freeanima/service"` (or expose via health/status).
- Do not maintain `version` in workspace sub-package `package.json`.
- Do not manually edit `CHANGELOG.md` or `[Unreleased]`; release notes come from commits and Release Please.

## Related Files

| File                                     | Role                                              |
| ---------------------------------------- | ------------------------------------------------- |
| `package.json`                           | Sole version write source (updated by Release PR) |
| `release-please-config.json`             | Release Please strategy and changelog sections    |
| `.release-please-manifest.json`          | Published version manifest                        |
| `.github/workflows/release.yml`          | release-please + npm publish                      |
| `.github/workflows/release-docker.yml`   | Docker image push to GHCR                         |
| `service/service/src/runtime/version.ts` | Runtime root version read                         |
| `CHANGELOG.md`                           | New version section appended on Release PR merge  |

## Repository Settings (Maintainers)

- Actions → General → **Allow GitHub Actions to create and approve pull requests**
- `RELEASE_PAT` must be able to open PRs and trigger CI on Release PR (cannot substitute default `GITHUB_TOKEN`)
