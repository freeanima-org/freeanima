---
name: auto-accept
description: >-
  FreeAnima 功能层 E2E 验收：用 just dev 起独立 Habitat+Web，优先经 Cursor 内置浏览器
  按「## 验收」操作 /web/*；操作后检查控制台与 Network 报错；UI 覆盖不到时用 Habitat RPC（/rpc/v1）验证，输出通过/失败报告。
  实现任务或功能改动完成后应主动使用；用户说「自动验收」「E2E」「浏览器验收」「验收一下」
  「补浏览器验收」「更新验收报告」时也使用。不是质量门禁（勿跑 just check）；不标记任务完成。
---

# 自动验收（浏览器 E2E + RPC 回退）

功能层验收，**不是** `just check`。本 worktree `just dev` + **浏览器为主**；仅当条目无可见 UI、或浏览器 MCP 不可用时，才用 Habitat RPC / 标「待人工」。

## 何时运行

- 实现任务/功能改动**完成后主动**跑一遍（默认）
- 功能变更 / bug 修复落地后，在浏览器验收前（或并行）主动跑：
  - `just qa test-unit`（全量 unit）
  - `just qa test-integration -- --core`（integration CORE；需 Docker）
- 用户明确要求「自动验收 / E2E / 浏览器验收 / 补浏览器验收」时
- 先前报告含「待人工」且原因是浏览器不可用，用户确认浏览器已就绪 / 说「需要」补 UI 时 → **只补浏览器行，重出完整合并报告**

## 输入来源（优先级）

1. 风巢任务：MCP `freeanima-fengnest-prod` → `task_get` → `content` 中「## 验收」
2. 对话 / PR / Issue 中的验收清单
3. 无显式验收：从目标与改动推导最小可验证清单，报告中标明「推导」

每条映射为可观察断言（UI 操作路径，或 RPC 方法 + 期望响应）。

## 验证通道（优先级）

| 顺序 | 通道                      | 何时用                                                             |
| ---- | ------------------------- | ------------------------------------------------------------------ |
| 1    | **浏览器** `/web/*`       | 有可见 UI / 可点击流程（布局、展开收起、下拉、对话框、同排标签等） |
| 2    | **Habitat RPC** `/rpc/v1` | 无 UI、或明确是 API/协议行为；也可为浏览器**预置数据**             |
| 3    | **待人工**                | 无 UI、无对应 RPC；或浏览器 MCP 不可用且该条只能靠 UI              |

**硬性**：不得在仍有 UI 路径、且 `cursor-ide-browser` 可用时，跳过浏览器只打 RPC。

**分流**：

| 条目性质                                     | 通道                                                           |
| -------------------------------------------- | -------------------------------------------------------------- |
| 协议字段 / CRUD / 种子数据                   | RPC 足够；有对应 UI 时**额外**用浏览器点一遍                   |
| 交互与呈现（折叠摘要、菜单、同行布局、配色） | **必须**浏览器；勿用 RPC「通过」代替                           |
| 列表项快捷菜单（ContextMenu / ActionSheet）  | **必须**浏览器点开菜单并 spot-check 至少一项（见 §3.2）        |
| 两者都有                                     | 报告通道写「浏览器」或「RPC + 浏览器」；结论以 UI 观察到的为准 |

## 流程

### 0. 先探浏览器 MCP

开跑前用 `GetMcpTools`（`server: cursor-ide-browser` 或 pattern `browser_`）确认可用。

| 状态     | 做法                                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| 可用     | 按 §3 跑浏览器；RPC 仅作协议项或预置                                                                                    |
| 不可用   | 报告开头写明「浏览器 MCP 不可用」；能 RPC 的先验；**纯 UI 标待人工**（原因：浏览器 MCP），**不得**把 UI 项标成 RPC 通过 |
| 稍后恢复 | 补跑待人工的浏览器行 → **重出完整报告**（合并先前 RPC + 新 UI），勿只贴增量                                             |

### 1. 解析验收条目

拆成 checklist。为每条选定通道，写入报告「操作路径」列。

### 2. 起独立服务

在**当前仓库根**（本 worktree）：

```bash
just dev
```

| 约定 | 说明                                                                                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 独立 | 本 worktree 源码进程 + 专用端口；**禁止**用生产 `anima service` / `:2658`                                                           |
| 端口 | Habitat 默认随机 ≥10000；Web 默认从 `:5000`（占用则 Vite 自增）。多 worktree 可设 `HABITAT_PORT` / `WEB_DEV_PORT`                   |
| 日志 | 解析 Habitat 端口与 Web URL（可能为 `https://127.0.0.1:<web>/web/`，以日志为准）                                                    |
| 就绪 | `GET http://127.0.0.1:<habitat>/rpc/v1/health/probe` 或打开 `/web/chat` 成功后再测                                                  |
| 认证 | Habitat 写 `~/.anima/dev-web.token`；浏览器同 origin 通常无需手贴；**RPC 须** `Authorization: Bearer $(cat ~/.anima/dev-web.token)` |
| 数据 | 默认 `~/.anima`。仅验收要求干净环境时才设 `FREEANIMA_HOME`                                                                          |

后台启动；**默认验收结束后保留** `just dev`。用户要求或端口冲突时再杀进程组。

### 3. 浏览器操作（MCP `cursor-ide-browser`）

硬性顺序：

1. `browser_tabs` list → 需要时 `browser_navigate` 到日志中的 Web 基址 + `/web/...`（注意 http/https）
2. 已有 tab：先 `browser_lock`，再交互
3. **结构 SSOT** = `browser_snapshot`；**视觉/异步列表/配色** = `browser_take_screenshot`（见下「易错点」）
4. 交互用 `browser_click` / `browser_type` / `browser_fill` 等（**勿** CDP `Input.*`）
5. 同一失败动作最多再试一次；四次仍无进展 → **停**，报告阻塞
6. **每条浏览器验收操作完成后**（整轮 unlock 前至少做一次汇总）：检查**浏览器控制台**与相关 **Network** 是否有报错（见 §3.1）
7. 整轮结束：`browser_lock` unlock（中途失败也要 unlock）

常用入口（base `/web/`）：`/web/chat`、`/web/habitat/dashboard`、`/web/settings`、`/web/tasks`、`/web/projects`、`/web/pomodoro`、`/web/vault`、`/web/notifications`、`/web/diary`、`/web/email`。

#### 浏览器易错点（必守）

- **先 snapshot 再点**：菜单开合、对话框、路由切换后 ref 会变；`element` 文案须与 snapshot `name` **一致**，否则易 stale
- **异步 UI**：首帧 a11y 可能仍是空态（如「暂无模板」）；列表/对话框内容以 **稍后 snapshot 或截图** 为准，勿凭首帧判失败
- **布局与配色**：snapshot 常看不到「同行 / 颜色区分」→ 关键断言用截图
- **勿与 mutation 并行读状态**：如点「展开」的同时用 CDP 读 `localStorage` 会竞态；先等 UI 稳定再读
- **CDP**：仅 `Runtime.evaluate` 等非 Input 用途（读 storage、短 sleep）；禁止 CDP 模拟键鼠
- **下拉**：插入项后菜单可能残留；需要时再开一次「添加…」或 `Escape` 后再操作
- **勿仅凭页面文案判通过**：页面能渲染、CDP 能读到 `innerText`，**不等于**验收通过；须结合 §3.1 控制台/网络检查

#### 3.1 控制台与网络检查（必做）

浏览器交互**每一步**（打开页面、点按钮、提交表单、关对话框等）完成后，在判定该条「通过」之前，**必须**检查是否有控制台或网络层错误。

| 检查项                                        | 做法                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Console `error` / `warning`（与本轮验收相关） | `browser_cdp` → `Log.enable`；必要时 `Runtime.enable`。操作后读近期日志（大响应会落盘到文件，读摘要即可） |
| `/rpc/v1/` 请求失败                           | `browser_cdp` → `Network.enable`；关注 **4xx/5xx**、重复路径（如 `/rpc/v1/rpc/v1/`）、连续失败轮询        |
| 页面未捕获异常                                | 操作后 `browser_snapshot` / 截图之外，用 CDP 确认无新增 error 级日志                                      |

判定：

- 与当前验收条目**直接相关**的 console error、未处理的 rejection、或关键 RPC 4xx/5xx → 该条标 **失败**（即使 UI 表面正常）
- 无关扩展/第三方噪音可记入报告「备注」，但须说明为何可忽略
- 证据列写：**错误摘要 + 请求 URL/方法**（勿贴 token）；例如 `GET …/rpc/v1/rpc/v1/emailaccount/list 404`

**禁止**：只用 `Runtime.evaluate(document.body.innerText)` 或截图当唯一通过依据而跳过控制台检查。

#### 3.2 列表项快捷菜单（必做，有则验）

任务或改动涉及「快捷菜单 / 更多操作 / 右键菜单」时，**不得**只验主流程（如添加、列表展示）而跳过菜单。

| 平台信号                        | 打开方式                                                                  |
| ------------------------------- | ------------------------------------------------------------------------- |
| `(pointer: fine)` 桌面 / 浏览器 | 账户/邮件等列表项 **`browser_click` + `button: "right"`** → `ContextMenu` |
| 触摸主输入（`useActionSheet`）  | 点行尾 **⋯**（`MoreHorizontal`）→ `ActionSheet`                           |

验收要求：

1. snapshot 确认菜单项文案与任务一致（如同步、编辑、启用/禁用、删除等）
2. **至少执行一项非破坏性操作**（如「编辑」打开对话框、「设为默认发件」）并确认 UI/RPC 反馈
3. 破坏性项（删除）仅在有测试数据且可清理时执行；否则验到确认框出现即可
4. 菜单操作后同样走 §3.1 控制台/网络检查

**禁止**：在任务明确要求快捷菜单时，只写「添加账户通过」而不点开菜单。

### 4. Habitat RPC 回退

打**本验收 Habitat**（日志中的端口 / `FREEANIMA_URL`，非 2658）：

```bash
TOKEN="$(cat ~/.anima/dev-web.token)"
curl -sS -H "Authorization: Bearer ${TOKEN}" \
  "http://127.0.0.1:<habitat>/rpc/v1/<domain>/<action>?<query>"
curl -sS -X POST -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d '{…}' "http://127.0.0.1:<habitat>/rpc/v1/<domain>/<action>"
```

约定：

- 方法名 `domain.action` → `/rpc/v1/domain/action`；HTTP 动词以注册为准
- **先**在源码 / 注册表确认方法名与参数，禁止臆造
- 也可经 Vite 代理：`<web-origin>/rpc/v1/...`（同样带 Bearer；https 时注意证书）
- 证据：路径 + 关键响应字段（**勿**贴完整 token）
- 破坏性写：仅验收必需；优先可逆数据，报告中注明

### 5. 逐条判定与修复边界

- 结果：`通过` / `失败` / `待人工`
- 失败不假装通过；**UI 可见但控制台/RPC 报错仍算失败**
- 待人工须写清原因（如「浏览器 MCP 不可用」）
- 可小范围修代码后**重验该条**；禁止借验收名义大改无关代码
- **本技能不跑** `just check` / lint / typecheck

### 6. 输出报告

用下方模板；中文。

- 全部通过 → 提示可进入 commit / cherry-pick / `task_complete`（**不代执行**；见个人技能 `fengnest-task`）
- 含待人工（浏览器不可用）→ 写明补救条件：「启用 cursor-ide-browser 后说『补浏览器验收』」
- **补跑 UI 后**：重出**完整**合并表（RPC 旧结论 + 浏览器新结论），更新「结论」行；勿只回一条「UI 也过了」

## 报告模板

```markdown
## 验收报告（E2E）

- 来源：风巢 #<id> | 对话推导 | …
- 环境：Habitat http://127.0.0.1:<habitat> · Web http(s)://127.0.0.1:<web>/web/ · just dev 仍在跑/已停
- 范围：浏览器优先；UI 不可达则 Habitat RPC（非 just check）
- 备注：（可选）浏览器 MCP 不可用 / 本轮为补浏览器验收、合并先前 RPC

| 条目 | 结果             | 通道                       | 操作路径                | 证据                               | 控制台/网络           |
| ---- | ---------------- | -------------------------- | ----------------------- | ---------------------------------- | --------------------- |
| …    | 通过/失败/待人工 | 浏览器/RPC/RPC+浏览器/人工 | /web/… 或 domain.action | snapshot / 截图要点 / 响应字段摘要 | 无 error / 有（摘要） |

结论：全部通过 | 未通过（N）| 含待人工（M）
下一步：…
```

## 硬性边界

- **不做**：`just check`、Playwright、`freeanima-testing`、自动 `task_complete` / push / cherry-pick
- 不拿生产 `:2658` 当验收目标；不把 Service Token 明文贴进对话/报告
- 风巢任务读写仍经 MCP `freeanima-fengnest-prod`（若需拉任务）
- 只在当前 worktree 起服与改代码；不跨仓动主工作区
