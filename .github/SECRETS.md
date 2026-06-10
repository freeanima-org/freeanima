# GitHub Actions Secrets

## `TESTING_REPO_DISPATCH_PAT`（Blackbox dispatch 必需）

主仓 PR 通过 Quality 后，向 [freeanima-testing](https://github.com/freeanima-org/freeanima-testing) 发送 `repository_dispatch`。

### 常见失败：`Resource not accessible by personal access token`

PAT **必须对目标仓库 `freeanima-testing` 有权限**，不是只对 `freeanima`。

#### Fine-grained PAT（推荐）

1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate
2. **Resource owner**：`freeanima-org`
3. **Repository access**：Only select repositories → 勾选 **`freeanima-testing`**
4. **Permissions**：
   - **Actions**：Read and write
   - **Metadata**：Read-only
5. 若组织启用 SSO：**Configure SSO** → Authorize token
6. 写入主仓 `freeanima` → Settings → Secrets → `TESTING_REPO_DISPATCH_PAT`

#### Classic PAT（备选）

- Scopes：`repo` + `workflow`
- 账号须对 `freeanima-org/freeanima-testing` 有 write 权限

### 验证

```bash
curl -sf -X POST \
  -H "Authorization: Bearer $TESTING_REPO_DISPATCH_PAT" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/freeanima-org/freeanima-testing/dispatches \
  -d '{"event_type":"pr-verify","client_payload":{"sha":"main","ref":"main","pr_number":0,"repo_full_name":"freeanima-org/freeanima"}}'
```

返回 **204** 表示 PAT 配置正确；**403 / Resource not accessible** 表示权限或 SSO 未授权。

## `MAIN_REPO_STATUS_PAT`（在 freeanima-testing 配置）

见 [freeanima-testing/.github/SECRETS.md](https://github.com/freeanima-org/freeanima-testing/blob/main/.github/SECRETS.md)。
