---
name: auto-accept
description: >-
  FreeAnima 功能层 E2E 验收：用 just dev 起独立 Hub+Web，优先经 Cursor 内置浏览器
  按「## 验收」操作 /web/*；UI 覆盖不到时用 Hub RPC（/hub/rpc/v1）验证，输出通过/失败报告。
  实现任务或功能改动完成后应主动使用；用户说「自动验收」「E2E」「浏览器验收」「验收一下」时也使用。
  不是质量门禁（勿跑 just check / lint / typecheck）；不标记任务完成。
---

# 自动验收（浏览器 E2E + RPC 回退）

功能层验收，**不是** `just check`。本 worktree `just dev` + 浏览器为主；**UI 测不到**且 Hub RPC 可达时，用 RPC 取证。

## 何时运行

- 实现任务/功能改动**完成后主动**跑一遍（默认）
- 用户明确要求「自动验收 / E2E / 浏览器验收」时

## 输入来源（优先级）

1. 风巢任务：MCP `feng-nest` → `task_get` → `content` 中「## 验收」
2. 对话 / PR / Issue 中的验收清单
3. 无显式验收：从目标与改动推导最小可验证清单，报告中标明「推导」

每条映射为可观察断言（UI 操作路径，或 RPC 方法 + 期望响应）。

## 验证通道（优先级）

| 顺序 | 通道 | 何时用 |
|------|------|--------|
| 1 | **浏览器** `/web/*` | 有可见 UI / 可点击流程 |
| 2 | **Hub RPC** `/hub/rpc/v1` | UI 测不到，但业务可通过 RPC 读/写验证 |
| 3 | **待人工** | 无 UI、无对应 RPC（或需真实设备/外部密钥等） |

不得在仍有 UI 路径时跳过浏览器只打 RPC（除非验收项明确是 API/协议行为）。

## 流程

### 1. 解析验收条目

拆成 checklist。为每条选定通道（浏览器 / RPC / 待人工），写入报告「操作路径」列。

### 2. 起独立服务

在**当前仓库根**（本 worktree）：

```bash
just dev
```

| 约定 | 说明 |
|------|------|
| 独立 | 本 worktree 源码进程 + 专用端口；**禁止**用生产 `anima service` / `:2658` |
| 端口 | Hub 默认随机 ≥10000；Web 默认从 `:5000`（占用则 Vite 自增）。多 worktree 可设 `HUB_PORT` / `WEB_DEV_PORT` |
| 日志 | 解析实际 `FREEANIMA_URL`（Hub）与 Web 端口 |
| 就绪 | `GET http://127.0.0.1:<hub>/hub/rpc/v1/health/probe` 或打开 `/web/chat` 成功后再测 |
| 认证 | Hub 写 `~/.anima/dev-web.token`；浏览器同 origin 通常无需手贴；**RPC 须** `Authorization: Bearer $(cat ~/.anima/dev-web.token)` |
| 数据 | 默认 `~/.anima`。仅验收要求干净环境时才设 `FREEANIMA_HOME` |

后台启动；**默认验收结束后保留** `just dev`。用户要求或端口冲突时再杀进程组。

### 3. 浏览器操作（MCP `cursor-ide-browser`）

硬性顺序：

1. `browser_tabs` list → 需要时 `browser_navigate` 到 `http://127.0.0.1:<web>/web/...`
2. 已有 tab：先 `browser_lock`，再交互
3. `browser_snapshot` = 结构 SSOT；关键断言用 `browser_take_screenshot`
4. 交互用 `browser_click` / `browser_type` / `browser_fill` 等（**勿** CDP `Input.*`）
5. 同一失败动作最多再试一次；四次仍无进展 → **停**，报告阻塞
6. 整轮结束：`browser_lock` unlock

常用入口（base `/web/`）：`/web/chat`、`/web/console/dashboard`、`/web/settings`、`/web/tasks`、`/web/projects`、`/web/pomodoro`、`/web/vault`、`/web/notifications`、`/web/diary`、`/web/email`。

### 4. Hub RPC 回退

打**本验收 Hub**（`FREEANIMA_URL`，非 2658）：

```bash
TOKEN="$(cat ~/.anima/dev-web.token)"
# 只读示例
curl -sS -H "Authorization: Bearer ${TOKEN}" \
  "http://127.0.0.1:<hub>/hub/rpc/v1/<domain>/<action>?<query>"
# 写入示例
curl -sS -X POST -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d '{…}' "http://127.0.0.1:<hub>/hub/rpc/v1/<domain>/<action>"
```

约定：

- 方法名 `domain.action` → 路径 `/hub/rpc/v1/domain/action`（点改斜杠）；读写 HTTP 动词以注册为准（常见只读 GET、写入 POST）
- **先**在源码 / 注册表确认真实方法名与参数，禁止臆造 endpoint
- 也可经 Vite 代理：`http://127.0.0.1:<web>/hub/rpc/v1/...`（同样带 Bearer）
- `health.probe` 等 `auth: optional` 可不带 token；业务方法必须带
- 证据：请求方法路径 + 关键响应字段（勿把完整 token 写进报告）
- 破坏性写操作：仅验收必需时做；优先用可逆/可清理的数据，并在报告注明

### 5. 逐条判定与修复边界

- 结果：`通过` / `失败` / `待人工`
- 失败不假装通过
- 可小范围修代码后**重验该条**；禁止借验收名义大改无关代码
- **本技能不跑** `just check` / lint / typecheck

### 6. 输出报告

用下方模板；中文。全部通过 → 提示可进入 commit / cherry-pick / `task_complete`（**不代执行**；见个人技能 `fengnest-task`）。

## 报告模板

```markdown
## 验收报告（E2E）
- 来源：风巢 #<id> | 对话推导 | …
- 环境：Hub http://127.0.0.1:<hub> · Web http://127.0.0.1:<web>/web/ · just dev 仍在跑/已停
- 范围：浏览器优先；UI 不可达则 Hub RPC（非 just check）

| 条目 | 结果 | 通道 | 操作路径 | 证据 |
|------|------|------|----------|------|
| … | 通过/失败/待人工 | 浏览器/RPC/人工 | /web/… 或 domain.action | snapshot / 响应字段摘要 |

结论：全部通过 | 未通过（N）| 含待人工（M）
下一步：…
```

## 硬性边界

- **不做**：`just check`、Playwright、`freeanima-testing`、自动 `task_complete` / push / cherry-pick
- 不拿生产 `:2658` 当验收目标；不把 Service Token 明文贴进对话/报告
- 风巢任务读写仍经 MCP `feng-nest`（若需拉任务）
- 只在当前 worktree 起服与改代码；不跨仓动主工作区
