# GitHub Actions Secrets

主仓 CI 统一使用组织级 **`FREEANIMA_CI`**（替代原 `RELEASE_PAT`、`TESTING_REPO_DISPATCH_PAT`）。

> **Blackbox 暂停（2026-07）**：[`ci.yml`](workflows/ci.yml) 的 `blackbox-dispatch` 已 `if: false`，PR 不再触发 `freeanima-testing` 或等待 `freeanima/blackbox`。`FREEANIMA_CI` 仍用于 Release Please；恢复 Blackbox 时见 `ci.yml` 内注释。

在 **freeanima-org** → Settings → Secrets and variables → Actions → Organization secrets 配置后，确保 `freeanima` 仓库可访问。

## `FREEANIMA_AMO_API_KEY` / `FREEANIMA_AMO_API_SECRET`（Firefox 扩展 unlisted 签名）

维护者本人 Windows Firefox **浏览器形态入口**自托管自动更新（canary）需要 AMO 签发 **unlisted** xpi（gecko id `extension@freeanima.com`）。

1. [AMO Developer Hub](https://addons.mozilla.org/developers/) → API Keys → 生成 JWT（issuer + secret）
2. 组织/仓库 Actions secrets：
   - **`FREEANIMA_AMO_API_KEY`** = JWT issuer
   - **`FREEANIMA_AMO_API_SECRET`** = JWT secret
3. [`canary.yml`](workflows/canary.yml) → `package-artifacts` 的 Firefox job 调用 `web-ext sign --channel=unlisted`
4. 产物：`freeanima-browser-extension-firefox.xpi` + `…-updates.json` 挂到 tag `canary`；site 同步到 `https://freeanima.com/extension/firefox/updates.json`

未配置时仍会打出**未签名** xpi（可 `about:debugging` 临时加载），但不能在正式 Firefox 上自动更新。

本机：`FREEANIMA_AMO_API_KEY=… FREEANIMA_AMO_API_SECRET=… just pack browser-extension-firefox`

## `FREEANIMA_CI`（Release Please + Canary + Blackbox dispatch）

同一 token 用于：

| 用途               | Workflow                        | 说明                                                                       |
| ------------------ | ------------------------------- | -------------------------------------------------------------------------- |
| Release Please     | `.github/workflows/release.yml` | 开 Release PR；须能触发 PR 上的 `ci.yml`（不能用默认 `GITHUB_TOKEN` 替代） |
| Canary Pre-release | `.github/workflows/canary.yml`  | force-move tag `canary` 并更新滚动 Pre-release 资产                        |
| Blackbox dispatch  | `.github/workflows/ci.yml`      | PR 通过 Quality 后向 `freeanima-testing` 发送 `repository_dispatch`        |

### 权限（Fine-grained PAT，推荐）

1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate
2. **Resource owner**：`freeanima-org`
3. **Repository access**：Only select repositories → 勾选 **`freeanima`**、**`freeanima-testing`**
4. **Permissions**（两仓均按需授予）：
   - **Actions**：Read and write（`freeanima-testing` dispatch 必需）
   - **Contents**：Read and write（`freeanima` Release PR 必需）
   - **Pull requests**：Read and write（Release Please 开 PR）
   - **Issues**：Read and write（Release Please 可选）
   - **Metadata**：Read-only
5. 若组织启用 SSO：**Configure SSO** → Authorize token
6. 写入组织 secret **`FREEANIMA_CI`**（或主仓 Secrets，名称保持一致）

#### Classic PAT（备选）

- Scopes：`repo` + `workflow`
- 账号须对 `freeanima-org/freeanima` 与 `freeanima-org/freeanima-testing` 有足够权限

### 验证 Blackbox dispatch

```bash
curl -sf -X POST \
  -H "Authorization: Bearer $FREEANIMA_CI" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/freeanima-org/freeanima-testing/dispatches \
  -d '{"event_type":"pr-verify","client_payload":{"sha":"main","ref":"main","pr_number":0,"repo_full_name":"freeanima-org/freeanima"}}'
```

返回 **204** 表示 PAT 配置正确；**403 / Resource not accessible** 表示权限或 SSO 未授权。

### Dependabot PR 与 Blackbox（已暂停）

Blackbox dispatch 已全局 `if: false`（见上文）。以下为 **恢复 Blackbox 后** 的 Dependabot 注意点：

由 **Dependabot** 触发的 workflow（`github.actor == 'dependabot[bot]'`）**无法读取 Actions / Organization secrets**，只能使用仓库或组织下的 **Dependabot secrets**。因此 `FREEANIMA_CI` 在 Dependabot PR 上为空时，`blackbox-dispatch` 会报 `Parameter token or opts.auth is required`。

恢复后可在 `blackbox-dispatch` 的 `if` 中跳过 **Dependabot PR** 与 **fork PR**（仅跑 Quality 等常规 CI）。Release Please PR 与同仓 contributor PR 不受影响。

若必须为 Dependabot PR 也跑 Blackbox，可在组织 **Dependabot secrets**（非 Actions secrets）添加同名 `FREEANIMA_CI`；高权限 PAT 暴露给 Dependabot 触发的 workflow，一般不建议。

详见 [Troubleshooting Dependabot on GitHub Actions](https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions)。

## `freeanima-testing` 侧（可选）

回写 PR commit status `freeanima/blackbox` 时，testing 仓可继续使用独立 secret，或同样引用组织级 **`FREEANIMA_CI`**（须含 **Commit statuses: Read and write** on `freeanima`）。

详见 [freeanima-testing/.github/SECRETS.md](https://github.com/freeanima-org/freeanima-testing/blob/main/.github/SECRETS.md)。
