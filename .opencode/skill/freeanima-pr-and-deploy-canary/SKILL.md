---
name: freeanima-pr-and-deploy-canary
description: >-
  FreeAnima：push → 开/复用 PR → 盯 CI 修到绿 → rebase 合并 → 盯 Canary →
  ssh feng.ecs 开 pon 后 anima upgrade --channel canary。
  用户执行 /freeanima-pr-and-deploy-canary，或说「推 PR 并部署 canary」「ship canary」
  「合并后升 feng」「PR and deploy canary」时使用。
---

# FreeAnima PR and Deploy Canary

> **命令**（用户入口）：`/freeanima-pr-and-deploy-canary`  
> **技能**（Agent 细则）：`freeanima-pr-and-deploy-canary`（本文件）

将功能分支一路送到风巢生产 canary 安装。用户调用本命令即授权：**合并 PR**、**盯 Canary**、**在 feng.ecs 上升级**。

## 前置

| 项     | 要求                                                                     |
| ------ | ------------------------------------------------------------------------ |
| 仓库   | `freeanima-org/freeanima`（或等价 origin）                               |
| 分支   | 功能分支上，非直接在脏 `main` 上乱推                                     |
| 工作区 | **干净**；脏改动先让用户确认 commit（本流程不 invent 业务 commit）       |
| 工具   | `gh` 已登录；本机可 `ssh feng.ecs`                                       |
| cwd    | 所有 `git` / `gh` / `just` / `bun` **固定在仓库根**（工具 cwd 可能漂走） |

## 顺序（硬性）

```
push → create/reuse PR → watch PR CI（红则修→push→再 watch）
  → gh pr merge --rebase → watch Canary on main（红则修→再 watch）
  → ssh feng.ecs：source bashrc.local → pon → anima upgrade --channel canary
  → 验收汇报
```

不得跳过红 CI / 红 Canary；不得改生产 host 或 channel。

## 1. Push

1. `git status` / `git branch -vv`：干净、确认当前分支
2. `git push -u origin HEAD`
3. pre-push（unit core 等）失败 → 修测 → **新建 commit**（hook 失败禁止 `--no-verify` / 随意 amend）→ 再 push

## 2. PR

1. `gh pr list --head "$(git branch --show-current)" --json number,url,state`
2. 已有 open PR → 复用其 number/url
3. 否则按 [`github-pr-create`](../github-pr-create/SKILL.md) 用 `gh pr create --base main`：
   - **版本分支**（如 `0.12.0.5`）或整分支多主题：标题用版本/主题概括，勿只抄最新一条 feat
   - 单主题短分支：标题优先最新有意义的 conventional commit
   - 正文中文：变更说明 + 测试情况；关联 Issue 写 `closes #N`
4. **不要**开 draft

## 3. 盯 PR CI 并修到绿

1. `gh pr checks <n> --watch --fail-fast`（`block_until_ms` 建议 ≥10min）
2. 失败时读日志（按序尝试，拿到真实失败即可）：

   ```bash
   # 首选
   gh run view <run_id> --job <job_id> --log-failed
   # 若 EOF / results-receiver 失败：落盘再搜
   gh api repos/freeanima-org/freeanima/actions/jobs/<job_id>/logs > /tmp/job.log
   rg -n '##\[error\]|^\(fail\)|tests failed|error:' /tmp/job.log | head -n 80
   ```

   - **不要**只看 log 末尾：Quality job 尾部常是 PG service-container 清理噪音
   - 优先定位 `(fail)` 用例名与首个 `error:` / `##[error]` 栈

3. 修复策略：
   - 日志指向 `tests/integration` → 先本地 `just qa test-integration -- <失败文件…>` 复现通过，再提交
   - 提交前对改动文件跑 `bun x oxfmt <files>`（或等价），避免 pre-commit 因格式打回
   - conventional commits **中文**；hook 失败 → **新建 commit**（禁止 `--no-verify` / 随意 amend）
   - push 后重新 `gh pr checks <n> --watch --fail-fast`
4. 优先级：冲突 > 未解决评论 > CI；本命令下 CI 绿且可合即可合
5. 无关红灯：可先 `git fetch origin main` 并入最新 base 再推；仍红则继续修本 PR 范围问题

## 4. 合并

本仓设置：**仅 rebase merge**。

```bash
gh pr merge <n> --rebase --delete-branch=false
```

- 禁止 `--squash` / 默认 merge commit（会被 API 拒绝）
- 禁止 force-push `main`
- 合完：`git fetch origin main`；记下 PR URL 与 `origin/main` tip SHA

## 5. 盯 Canary

合入后新 run 可能晚几秒出现。**必须**确认盯的是本次 tip，勿误盯上一轮 success：

```bash
MAIN_SHA=$(git rev-parse origin/main)
# 若最新一条 headSha ≠ MAIN_SHA：短等 5–15s 再 list，或：
gh run list --workflow=canary.yml --branch main --commit "$MAIN_SHA" --limit 1 \
  --json databaseId,status,conclusion,url,headSha
gh run watch <id> --exit-status   # Canary 常 10–20min；block_until_ms ≥20min
```

失败：

1. 拉失败 job 日志（同 §3 兜底），定位打包/签名等错误
2. 在仓内修 → 推 `main`（或短 hotfix 分支再 rebase 合入）
3. concurrency group `canary-main` 会取消旧 run → **盯新一轮** Canary直到 `conclusion=success` 且 `headSha` 仍对齐 tip

Canary 未绿 **不得**上生产升级。

## 6. 生产升级（固定）

非交互 SSH **不会**自动加载交互式 alias；必须 source `~/.bashrc.local` 才有 `pon`。

升级含下载、停服、启服、等 Habitat/迁移，常 **≥1min**。SSH 调用 `block_until_ms` 建议 **≥180s**（不足则后台等待，勿当失败）。

```bash
ssh feng.ecs 'bash -lc "set -euo pipefail; source ~/.bashrc.local; pon; anima upgrade --channel canary; anima --version; anima service status; curl -fsS http://127.0.0.1:2658/rpc/v1/health/probe"'
```

| 固定项 | 值                                      |
| ------ | --------------------------------------- |
| Host   | `feng.ecs`                              |
| 代理   | `pon`（mihomo 用户服务 + 代理环境变量） |
| 升级   | `anima upgrade --channel canary`        |

`pon` 还会把 `~/.anima/bin` 提前到 PATH，避免被其它 `anima` 盖住。

## 7. 验收与汇报

同一次 SSH 输出应已含 version / status / probe；再核对：

- `anima --version` → `…-canary+… (standalone) · canary`
- `anima service status` → running；build commit 与刚成功的 Canary / `main` tip 对齐
- probe → `"status":"ok"`

### 汇报模板

```markdown
## freeanima PR → canary 部署结果

- PR：<url> #<n>（已 rebase 合并）
- Canary：<run url>（success）
- feng：<version 串> · commit <short> · health ok
```

## 相关技能

| 技能                                               | 何时            |
| -------------------------------------------------- | --------------- |
| [`github-pr-create`](../github-pr-create/SKILL.md) | 写 PR 标题/正文 |

## 命名对照

| 类型     | 名称                              | 用途                     |
| -------- | --------------------------------- | ------------------------ |
| **命令** | `/freeanima-pr-and-deploy-canary` | 用户聊天入口             |
| **技能** | `freeanima-pr-and-deploy-canary`  | Agent 完整流程与失败处理 |

## 禁止

- `--no-verify` / force-push `main` / squash 或 merge-commit 合 PR
- 跳过红 CI 或红 Canary 直接升 feng
- 改 host、改 channel、跳过 `pon`
- 把 feng.ecs / pon 细节写进 freeanima **仓库** rules（本技能仅用户级）
