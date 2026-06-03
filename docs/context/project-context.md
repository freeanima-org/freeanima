# 逸灵风动态上下文

> 会变的项目细节。根 [AGENTS.md](../../AGENTS.md) 保留 boot 协议；工具清单、命令、目录结构见本文件。
> 文档地图与维护规约见 [AGENTS.md](../../AGENTS.md#文档地图)。

**运行状态（2026-05-27）**：**TypeScript 单栈**；生产形态为 `anima service`（Bun fullstack WebUI + tRPC，由 `packages/server` 同进程启动）。Python 实现已从仓库移除，历史见 Git 提交记录与 [CHANGELOG.md](../../CHANGELOG.md)。

## 工具使用策略（当前工作方式）

| 场景 | 推荐方式 | 原因 |
|------|---------|------|
| 读 1-2 个文件 | 直接 `read_file` | 最快，零开销 |
| 单文件小修改 | `patch` | 精确，可追溯 |
| 跨多文件代码分析/实现 | Cursor Agent | 委托 IDE，比 delegate_task 更直接 |
| 设计决策 / 架构判断 | Cursor Agent 出多方案，由部署者或主 Agent 做判断 | 素材来自 Cursor，选择权在运行实例 |

## 家目录 `~/.anima/`

逸灵风（Free Anima）的所有持久化数据统一存储在 `~/.anima/`（历史路径；可用 `FREEANIMA_HOME` 覆盖）。

```
~/.anima/
├── config.yaml         # 运行时配置（模型、firecrawl、discord 等）
├── active              # 当前活跃 session 名
├── SOUL.md             # 身份种子（注入 system prompt）
├── sessions/           # L1 历史归档目录（运行时主存为 PostgreSQL）
├── processed/          # L2 蒸馏 JSONL
├── memory/             # L3 事实文件 (*.md)
├── functions/          # 职能 TOML
├── skills/             # 技能 Markdown（*.md）
├── active_skills.json  # 全局已加载技能列表
├── index/              # L4 SQLite FTS 索引
├── cron/               # 定时任务（jobs.json、scripts/、output/）
├── error.log           # 运行时错误日志（API/SSE/LLM/EventBus/平台/服务启动失败）；`anima service start --foreground` 启动异常写入 `[startup]`；微信 poll 单次失败仅 console.warn，连续失败才写入；Discord 网关错误经 client/shard 事件记录
├── weixin/             # 微信 iLink 同步游标与 context_token
└── ...
```

- 新增模块需要持久化时，数据放在此目录下
- 不依赖 XDG 或系统其他路径
- 备份只需打包这一个目录

## 对话日志格式（L1）

L1 Session 主存为 PostgreSQL（`config.yaml` → `database.url`）。表设计见 [database.md](../database.md)。

**L1 PostgreSQL（Slice A）**：`packages/db/` — `sessions`（一行 = `session_meta`）+ `messages`（`payload` JSONB = `ConversationMessage`）；`anima service` 启动时 `getDb()` 连接池，engine/memory 进程内直调 repo；热路径 `getSessionMetaLite`（不读 `tools` JSONB）、压缩后 `listMessagesByIdRange`、API `offset`/`limit` 走 `listMessagesPage`；诊断：`ANIMA_L1_PG_PROFILE=1`、`packages/db/scripts/session-size.sql`；`bun run --filter @freeanima/legacy-db db:migrate`。

`NestService` 与 cron 引擎路径在 `engine.run` / `engine.runStream` 落盘：**最终 assistant** 即时 `appendMessage`；**tool loop 一轮**（assistant+tool_calls + 全部 tool 响应）**原子批量**落盘；`finishTurn(..., skipMessageAppend=true)` 只做 `session_meta` 更新。历史若出现 dangling `tool_calls`，`beginTurn`/`prepareMessages` 会在 **assistant 原位** 补 synthetic tool（后续 pos 后移）并修复；伙伴新消息可 **AbortController 抢占** 进行中的 tool loop。

第一行是 `session_meta`：
```json
{"role": "session_meta", "model": "...", "tools": [...], "cwd": "...", "title": "...", "todos": {"items": [], "next_id": 1}, "acp_sessions": {"cursor": "<acp-session-uuid>"}, "timestamp": "..."}
```

`todo` 工具数据存于 **当前 session** 的 `session_meta.todos`（非全局 `todos.json`）。

后续行是 OpenAI 格式消息 + 扩展字段：

| 字段 | 适用范围 | 说明 |
|------|---------|------|
| `role` | 全部 | user / assistant / tool |
| `content` | 全部 | 消息正文 |
| `timestamp` | 全部 | UTC ISO8601，由 `append_message` 自动注入 |
| `model` | assistant | 实际使用的模型名 |
| `tool_calls` | assistant | 工具调用列表（完整 payload） |
| `tool_call_id` | tool | 对应调用的 ID |
| `reasoning` | assistant | 标准化推理文本（如有则保留） |
| `finish_reason` | assistant | 结束原因（stop / tool_calls / length 等） |
| `usage` | assistant | LLM 返回的 token 用量 |
| `latency_ms` | assistant | 单次 LLM 请求耗时（毫秒） |

设计原则：
- raw data 完整存档，不裁剪任何字段
- model 在消息级，换模型语义清晰
- `load()` 跳过 session_meta
- **运行时压缩 v5.1**（`compressor.ts` + `compression-summary.ts`）：四段视图 l0–l4；meta `{ l2, l3, summary? }`；`deriveBoundariesFromL4`（`raw_min_messages` / `slim_min_messages`）；`trigger_low` 0.60 外 / `trigger_high` 0.80 内；`isInToolLoop` 仅影响 `shouldAdvance`；摘要增量 `(旧 l2, 新 l2]`；合成 `pos=1` 摘要 user；emergency 就地裁切；`/compress`；L1 全量存档不删
- **`/stats`**：`conversation-stats` + `runtime-context-stats`；压缩状态按 **token 占用率**（或条数回退）；**当前上下文**从 `buildRuntimeMessages` + `meta.tools` 分项（SOUL/AGENTS/常驻/技能/摘要/消息/tools schema）
- L1 原始 JSONL → L2 蒸馏 → L3 事实 → L4 检索，详见 [memory.md](../memory.md)
- **TypeScript 类型**：`packages/kernel/src/schemas/` 为 Zod 单一真相源（L1 `message.ts`、EventBus `events.ts` 等）；HTTP 入站/出站契约在 `@freeanima/legacy-api`（Zod）；`packages/server/src/api-mappers.ts` 将内部类型映射为 API DTO；工具返回约定见 `json-util.parseToolResult`
- **L3 FTS**：热路径 `remember` / reflect 写入后 `indexL3Fact` / `indexL3Facts` 增量索引；全量 `indexL3All` 仅卧室「重建 L3 索引」或兼容旧 `l3:updated` 无 `fact_ids` 时

## 架构速览

> **RFC #1 步骤 0（2026-06-02）**：`packages/*`、`apps/*` 已 rename 为 `@freeanima/legacy-*`（见下方映射表）。新栈包名将占用 `@freeanima/kernel` 等目标名，见 [`docs/designs/issue-1-migration-plan.md`](../designs/issue-1-migration-plan.md)。

**Legacy 包名映射：**

| 目录 | npm 包名 |
|------|----------|
| `packages/kernel` | `@freeanima/legacy-kernel` |
| `packages/engine` | `@freeanima/legacy-engine` |
| `packages/runtime` | `@freeanima/legacy-runtime` |
| `packages/memory` | `@freeanima/legacy-memory` |
| `packages/db` | `@freeanima/legacy-db` |
| `packages/server` | `@freeanima/legacy-server` |
| `packages/gateway` | `@freeanima/legacy-gateway` |
| `packages/tools` | `@freeanima/legacy-tools` |
| `packages/integrations` | `@freeanima/legacy-integrations` |
| `packages/clarify` | `@freeanima/legacy-clarify` |
| `packages/api` | `@freeanima/legacy-api` |
| `apps/cli` | `@freeanima/legacy-cli` |
| `apps/webui` | `@freeanima/legacy-webui` |

```
kernel/             # RFC #1 新栈（与 legacy packages/ 并行）
├── event-bus/      # @freeanima/event-bus：EventTopic + EventBus + EventQueueAdapter；子路径 memory / null
├── hooks/          # @freeanima/hooks：Hook token + HookRegistry（run→HookRunResult 结果链 prev）
├── logging/        # @freeanima/logging：Logger / LogSink / createLogger；子路径 console / file / memory / null
└── kernel/         # @freeanima/kernel：Kernel 组合端口（HookRegistry + EventBus + Logger）
apps/
├── cli/            # anima 入口：service / credential / completion
└── webui/          # React 19 CSR + TanStack Router；Bun fullstack HTML entry；tRPC client → packages/server
packages/
├── event-bus-sqlite/ # @freeanima/event-bus-sqlite：SqliteEventQueue（bun:sqlite，实现 EventQueueAdapter）
├── api/            # HTTP 契约（Zod schema + 类型）；仅依赖 zod
├── kernel/         # @freeanima/legacy-kernel：paths、config、hook token/context、schemas/*（openSqlite 仅 bun:sqlite）
├── db/             # @freeanima/legacy-db：L1 Session PG（sessions + messages.payload JSONB）、Drizzle migrate
├── engine/         # conversation、session-store（PG）、compressor、llm、engine 回合；export kernel（含 hookRegistry 端口）
├── memory/         # L1–L4 存储/检索、reflect、events token、registerMemoryPipeline（+ registerMemoryHandlers 别名）
├── runtime/        # NestService、commands、cron、studio、platforms 辅助、conversation-stats
├── clarify/        # clarify 工具与 hook 注册
├── gateway/        # 入站消息通道：Discord、微信；cron deliver；流式回复收集
├── core/           # 兼容门面：re-export kernel/clarify/engine/memory/runtime + network-error
├── server/         # serve() + handlers/ + trpc/；Bun fullstack WebUI + node:http（tRPC WS）；EventBus + SqliteEventQueue
├── tools/          # 本地工具注册
└── integrations/   # MCP、ACP
tests/           # Vitest 回归
```

## 已注册工具（TS 首版）

| 工具 | 来源 | 说明 |
|------|------|------|
| `read_file` | `packages/tools/src/file.ts` | 读文本文件，行号+分页，阻塞设备/二进制 |
| `write_file` | `packages/tools/src/file.ts` | 覆写文件，路径安全 |
| `search_files` | `packages/tools/src/file.ts` | `target=files`：glob 文件名（支持 `a\|b`）；`target=content`：默认字面量（`regex=true` 为正则）；`files_only`+glob 形态 pattern 自动按文件名 |
| `patch` | `packages/tools/src/file.ts` | 字符串替换 |
| `terminal` | `packages/tools/src/terminal.ts` | shell 前台/后台，超时、workdir |
| `process` | `packages/tools/src/terminal.ts` | 管理 `terminal(background=true)` 进程 |
| `web_search` | `packages/tools/src/web.ts` | Firecrawl 搜索（`services/firecrawl`） |
| `web_extract` | `packages/tools/src/web.ts` | Firecrawl 抓取 URL |
| `browser_navigate` / `browser_snapshot` / `browser_click` / `browser_type` / `browser_scroll` / `browser_back` / `browser_press` / `browser_console` / `browser_get_images` / `browser_vision` | `packages/tools/src/browser.ts` | 浏览器交互（V1 仅 **Camofox REST** 后端）；`config.yaml` → `browser.camofox.base_url`；按 L1 session 隔离 tab；`browser_vision` 暂存截图路径（auxiliary vision 未接入） |
| `clarify` | `packages/tools/src/clarify-tool.ts` | 批量提问（`items`）；`required=true` 时暂停 tool loop，状态存 session meta `awaiting_clarify`；`required=false` 需 `default` 自动续跑；`/cancel` 取消 |
| `list_credentials` | `packages/tools/src/credential-tool.ts` | 列出 pass 凭证（无值） |
| `execute_code` | `packages/tools/src/execute-code.ts` | 子进程执行代码；`runtime` 默认 `nodejs`（TS/JS）；`python`/`deno` 预留未启用。设计见 [`docs/designs/execute-code-runtimes.md`](../designs/execute-code-runtimes.md) |
| `remember` | `packages/tools/src/memory-tools.ts` | 写入 L3 事实并增量更新 `index/l3.db` |
| `recall` | `packages/tools/src/memory-tools.ts` | L3 事实 FTS + L2 历史对话 FTS（`index/l2.db`） |
| `todo` | `packages/tools/src/todo-tool.ts` | 当前 session 待办（`session_meta.todos`） |
| `cronjob` | `packages/tools/src/cronjob.ts` | 定时任务 CRUD / 立即运行 |
| `create_skill` / `load_skill` / `unload_skill` / `list_skills` / `view_skill` / `delete_skill` | `packages/tools/src/skills-tools.ts` | 技能文件 + 全局 active 列表 |
| `acp_{agent}` | `integrations/src/acp/manager.ts` | ACP 委托；默认绑定逸灵风 session；参数 `goal`、`context`、`new_session`、`session_id` |

待补工具/命令：`send_push`、`help`（工具全景）、更多 slash（如 `/reset` 等）。见 [TODOS.md](../../TODOS.md)。

**Gateway**：Discord / 微信 iLink 已接入（`service start` 时按 pass 自动发现）；Discord 登录失败时每 **5 分钟**自动重试（`DISCORD_LOGIN_RETRY_MS`）；Discord API 发送/编辑遇 **429、5xx 或瞬态网络** 时指数退避重试（最多 5 次，尊重 `retryAfter`）；流式回复最终 edit 仍失败则 **fallback 新发一条**，避免卡在「思考中」；Discord 启动时同步 **Application Slash Commands**（输入 `/` 出现候选，与消息内 `/cmd` 并存；`config.yaml` → `discord.slash_commands` / `slash_commands_guild_id`）；普通对话走 `sendMessageStream` 时先发「思考中」占位并按事件流节流编辑，收尾去掉占位；`tool_begin` 仅展示工具名，`tool_result` 不展示返回正文；微信状态目录 `~/.anima/weixin/`（`sync.json`、`context-tokens.json`）。

**Slash 命令（Gateway）**：`/new`、`/sethome`（alias `/set-home`）仅 Discord / 微信；`/sethome` 将当前聊天写入 `config.yaml` 对应平台的 `home_channel`（cron 等主动通知的默认投递目标）。

**Cron**：任务定义 `~/.anima/cron/jobs.json`；脚本 `~/.anima/cron/scripts/`；输出 `~/.anima/cron/output/`。字段 `deliver` 支持 `local`、`discord[:channel_id[:thread_id]]`、`discord`（home channel）、`weixin[:peer_id]`、`weixin`、`all`。长脚本可设 `timeout_sec`（默认 300，VM 备份示例 1800）。失败后最短 **5 分钟** 再调度（`POLL_INTERVAL_MS` 10s）。Discord cron deliver 在 adapter `start()` 时注册（不等待 gateway `ready`）。示例：VM 磁盘每日备份任务（`0 3 * * *`）。

MCP：`integrations/src/mcp/`（`@modelcontextprotocol/sdk`）；**HTTP listen 后后台并行连接** `enabled !== false` 的 server（默认 15s 超时），`tools/list` 后以 `mcp_{server}_{tool}` 注册；卧室 `/webui/chamber/mcp` 可手动启停；`toolset` 为 `mcp:{server}`；SSE 可选 `api_key_env`。

ACP：`integrations/src/acp/`；`acp_{name}` 返回 JSON（`session_id`、`output`、`new_session`、`reused_binding`）。**HTTP listen 后后台并行连接** `enabled !== false` 的 agent（`connect_timeout_ms` 默认 15s，`prompt_timeout_ms` 默认 120s）；卧室 `/webui/chamber/acp` 可手动启停。**Session 策略（混合 C）**：默认当前逸灵风 L1 session ↔ 每 agent 一个 ACP session（`session_meta.acp_sessions`）；`new_session: true` 强制新建并更新绑定；显式 `session_id` 优先。同 agent 请求经 `AcpAgentQueue` 串行。适配器见 `adapters/cursor`（[Cursor ACP](https://cursor.com/docs/cli/acp)）。

## HTTP / tRPC API（WebUI）

**WebUI RPC**：[`packages/server/src/trpc/router.ts`](../../packages/server/src/trpc/router.ts) 导出 `AppRouter`；WebUI 用 [`apps/webui/src/lib/trpc.ts`](../../apps/webui/src/lib/trpc.ts)（`httpBatchLink` + `httpSubscriptionLink` + 终端 `wsLink`）。Zod 约束复用 `@freeanima/legacy-api`。

| 传输 | 路径 | 用途 |
|------|------|------|
| HTTP batch | `POST /api/trpc/*` | query / mutation |
| SSE subscription | `GET /api/trpc/*`（EventSource） | 聊天流 `messages.sendStream` 等 |
| WebSocket | `WS /api/trpc/ws` | `studio.terminal.*`（write/resize mutation + stream subscription） |
| REST（可选） | `GET /api/health` | 探活 |

**启动**：`packages/server/webui-server.ts` — 对外 `node:http`（API + WS）；内嵌 Bun fullstack dev server（`127.0.0.1:随机端口`）代理 `/webui/*` HTML/TSX/CSS（HMR）。**无需** `vite build` / `dist/server`。

**WebUI 前端**：[`apps/webui/index.html`](../../apps/webui/index.html) + CSR [`main.tsx`](../../apps/webui/src/main.tsx)；TanStack Router（保留）；已移除 TanStack Start / Vite / `server/fns`。

旧 REST 端点（`/api/sessions/...` 等）由 tRPC procedure 替代；下表保留语义对照。

| 端点 | 响应要点 |
|------|----------|
| `GET /api/health` | `{ status: "ok", version }` |
| `GET /api/status` | `status`, `version`, `pid`, `tools`, `cron_jobs`, `uptime_seconds`, `start_time_iso`, `memory_kb`, `config`（`model`, `api_base`）, `platforms`, `sessions`（`total`, `by_platform`）, `memory`（`files_count`, `files_bytes`, `facts_count`, `l2_index_rows`）；卧室 `/webui/chamber/dashboard` |
| `GET /api/memory` | `{ files: [{ name, path, size, mtime, content }] }`（SOUL/MEMORY/USER + `memory/f-*.md`；卧室 `/webui/chamber/memory-files`） |
| `POST /api/memory/search` | `{ query, l3[], l2[] }` — 同 `recall` 参数：`query`（必填）、`limit`、`session_limit`、`session`；每条含 FTS `rank` 与归一化 `score` |
| `POST /api/memory/l2-distill` | `{ ok, sessions, message }` — 仅从 L1 重蒸馏 `processed/`（卧室记忆台） |
| `POST /api/memory/l2-reindex` | `{ ok, index_rows, message }` — 清空并重建 `index/l2.db`（不蒸馏） |
| `POST /api/memory/l3-reindex` | `{ ok, index_rows, message }` — 清空并重建 `index/l3.db` |
| `POST /api/memory/l2-rebuild` | `{ ok, sessions, index_rows, message }` — 蒸馏 + L2 索引组合（兼容旧脚本） |
| `POST /api/sessions/:id/messages/stream` | SSE：`token` / `content_replace` / `tool_*` / `error` / `done`（`tool_begin` 的 data 含 `tool`、`args`）；`event:error` 写入 `error.log`；platform 从 session meta 自动解析；**唯一**消息发送端点（非 SSE `POST .../messages` 已移除） |
| `GET /api/sessions` | `{ sessions[] }`；`?platform=` 过滤（省略则全 platform）；会客厅默认 `parlor`；卧室会话列表拉全量 |
| `GET /api/sessions/:id/messages` | `{ session_id, display[], total?, offset?, limit? }`；`display` 含 `message` / `tool_block`（tool_calls+tool 聚合）；`?offset=&limit=` 分页（默认卧室每页 100；不传 limit 则全量，兼容会客厅） |
| `POST /api/sessions` | `{ session_id }`；body `{ platform? }`（默认 `parlor`） |
| `GET /api/studio/config` | `{ workspace, gitignore, showHidden }` — `config.yaml` → `studio` 段；创作室 `/webui/studio/pair-programming` |
| `PUT /api/studio/config` | 合并写入 `studio` 段 |
| `GET /api/studio/tree` | `{ tree[], workspace }` — workspace 文件树（`.gitignore` 过滤） |
| `GET /api/studio/file` | `?path=` → `{ path, content, language, size }`（1MB 上限，workspace 内） |
| `POST /api/studio/search` | `{ query }` → `{ results[{ file, line, column, content, match }] }`（优先 rg） |
| `WS /api/studio/terminal` | xterm 终端；JSON `{ type: input\|output\|resize\|ready\|error\|exit }`；cwd = `studio.workspace` |
| `GET /api/commands` | 已注册 slash 命令；默认按 `parlor` 平台过滤（`?platform=discord`、`?all=1` 查全量）。响应含 `scope`（`session` / `global`）、`platforms`（`null` 表示全平台）。`/new` 仅 `discord`、`weixin`；卧室 `/webui/chamber/commands` |
| `GET /api/cron` | 定时任务列表（`cron/jobs.json`）；卧室 `/webui/chamber/cron` |
| `POST /api/cron/:id/pause` | 暂停任务，返回 `{ ok, job }` |
| `POST /api/cron/:id/resume` | 恢复任务并重算 `next_run_at`，返回 `{ ok, job }` |
| `POST /api/cron/:id/run` | 立即触发（异步），返回 `{ ok, message, job }` |
| `GET /api/sessions/:id` | 含 `stats` 文本（对话 token 消耗统计） |
| `GET /api/mcp` | MCP 配置与状态：`server_count`、`connected_count`、`connecting_count`、`tool_count`、`servers[]`（每 server：`config`（含 `enabled`）、`status`（含 `connecting`/`disabled`）、`tools`、`resources`、`prompts`、`registered_tools`） |
| `POST /api/mcp/start-all` | 启动所有 `enabled` 且未连接的 server，返回最新 status |
| `POST /api/mcp/stop-all` | 停止全部已连接 server，返回最新 status |
| `POST /api/mcp/:name/start` | 手动启动单个 server |
| `POST /api/mcp/:name/stop` | 手动停止单个 server 并注销工具 |
| `GET /api/acp` | ACP 配置与状态：`agent_count`、`connected_count`、`session_count`、`tool_count`、`agents[]`（`config`、`status`、`tool`、`sessions`） |
| `POST /api/acp/start-all` | 连接全部 `enabled !== false` 的 agent（`initialize`）；任一失败返回 400 + 聚合 error |
| `POST /api/acp/stop-all` | 断开全部 agent 并清空进程内 session 登记（`session_meta.acp_sessions` 绑定保留） |
| `POST /api/acp/:name/start` | 连接单个 agent |
| `POST /api/acp/:name/stop` | 断开单个 agent |
| `POST /api/service/restart` | `{ ok, message }` — 卧室仪表盘「重启服务」；systemd 托管时 `systemctl --user restart anima`，否则 SIGTERM 优雅关停 |

## 开发命令

```bash
bun install                       # 依赖；需 Bun 1.3+（见 .bun-version）
bun run test                      # 全仓测试（单元 + 集成；有 Docker 时自动起 PG）
bun run test:changed              # 增量 + pre-commit；命中集成用例时自动起 PG
bun run typecheck                 # tsgo 全仓（根 tsconfig.json）

# CLI（直接跑 TS 源码）
bun run service start                              # systemd / detached
bun run service start --foreground                 # 前台 dev：Bun fullstack HMR，无需 build
bun run service stop | restart | status
bun run anima -- service start
bun run anima -- credential list
bun run anima -- credential get services/discord token
bun run anima -- credential add services/foo token=xxx desc=说明

# shell 补全（写入 ~/.bashrc 或 ~/.zshrc 一次）
eval "$(anima completion bash)"
# source <(anima completion zsh)

# 全局 CLI（本机一次；任意目录可用 anima）
bun run link:global                               # symlink cli.ts → ~/.bun/bin/anima（workspace 包勿用 bun link -g，不会装 bin）
# bun link -g 仅登记 linkable，不写 ~/.bun/bin；bun install -g 也无法解析 workspace:*
# PATH：~/.bun/bin 须在旧 pnpm 全局 bin 之前，否则 which anima 仍指向旧版
anima service status

# unit：~/.config/systemd/user/anima.service（`service start` 自动生成，勿手抄仓库内模板）
#   Restart=always；崩溃后 180s 再拉起；StartLimitIntervalSec=0（不因连续失败放弃）

# WebUI: http://127.0.0.1:2658/webui/parlor/chat
# 卧室: …/webui/chamber/dashboard  创作室: …/webui/studio/pair-programming
bun install                       # Husky：提交前 typecheck + test:changed；commit-msg 校验 Conventional Commits
bun run check                     # 手动全量：typecheck + 全量测试（推 PR 前建议）
```

**构建**：TS 包由 Bun 直接加载 `src`（无 emit）；WebUI 由 Bun fullstack 按需编译，**无**单独 `vite build` 步骤。

**类型检查**：`bun run typecheck` → `bunx tsgo -p tsconfig.json --noEmit`（根 [`tsconfig.json`](../../tsconfig.json)，含 `src` + 全仓 `*.test.ts` / `tests/`）。

**测试**：`bun run test`（[`scripts/run-tests.mts`](../../scripts/run-tests.mts)）先尝试 Docker 起临时 PG，再根目录 `bun test`。**本地与 pre-commit** 用 `bun run test:changed`；**CI** 全量 `bun run test`；推 PR 前可 `bun run check`。

**WebUI 启动**：`anima service start --foreground` → `development: true`（Bun fullstack + tRPC）；systemd/detached 同进程 TS 直跑，无需预构建。
**覆盖率范围**：Bun 会统计**测试执行过程中被 import 到的所有源码**（含 workspace 依赖），与「只跑了哪个目录的 `*.test.ts`」无关。因此在 `kernel/hooks` 跑覆盖率仍会出现 `../logging/...`，在 `kernel` 跑则会合并 hooks + logging + kernel 的 src。Bun 暂无「只统计 cwd 下 src」的内置开关。

**`bunfig.toml` 与 cwd（Bun 1.3.14）**：根目录 `bun test` / `bun test kernel/hooks` 的 **cwd 在仓库根**，会加载根 [`bunfig.toml`](../../bunfig.toml)（`coverageThreshold`、`pathIgnorePatterns` 等）。**`cd kernel/hooks && bun test` 不会**继承根 `bunfig`（子目录无本地 `bunfig.toml` 时相当于默认配置）。单包调试若要用根上的阈值/忽略规则，应在根执行 `bun test kernel/hooks --coverage`，或在子包放本地 `bunfig.toml` / `BUN_CONFIG`。

**WebUI Tailwind**：`anima service start` 从仓库根启动内嵌 `Bun.serve`，须根 `bunfig.toml` 的 `[serve.static] plugins = ["bun-plugin-tailwind"]` 且根 `devDependencies` 含 `bun-plugin-tailwind`；`serve()` 会 `chdir(REPO_ROOT)`，systemd unit 含 `WorkingDirectory`/`FREEANIMA_REPO_ROOT`，否则 CSS 无 utility 类。

**TS 配置**：根 [`tsconfig.json`](../../tsconfig.json)（门禁 + IDE：全仓 `src`、WebUI、单元/集成测试）；[`apps/webui/tsconfig.json`](../../apps/webui/tsconfig.json) 继承根配置并覆写 `@/*` paths（单独打开 webui 目录时用）。

版本号：根 `package.json`（运行时 `NEST_VERSION`）。发版见 [versioning.md](../versioning.md)。

## 任务管理

`TODOS.md` 是本项目的共享任务清单（**只含未完成项**）。

- 新 session 先读 `TODOS.md`
- 完成后**从 TODOS 删除**，不勾选保留；用户可见变更用 `feat:` / `fix:` 等 Conventional Commits（发版时 semantic-release 写入 CHANGELOG）
- 发现新待办先写入 `TODOS.md` 再开工
- `TODOS.md` 是 session 间任务连续性的锚点

## 测试策略

- 单元测试：直接调 handler，mock 外部依赖
- 集成测试：mock LLM，验证 engine 完整 dispatch 流程
- 每个工具模块至少有一个注册测试 + 一个功能测试
- 新功能必须同时补测试（最小化但保证基本可用）
- 需真实 LLM 的用例：单独文件或 `describe.skip`，默认 CI 不跑
- 需外部网络的用例：显式标记或隔离，默认不跑

## 工具注册约定

| 方式 | 适用场景 | 示例 |
|------|---------|------|
| `@tool(description=...)` | 简单工具，自动生成 schema | `send_push`, `remember` |
| `@tool(schema=...)` | 需要长描述/精准参数 | 部分 memory 工具 |
| `registry.register(...)` | 显式 schema / check_fn / toolset | `read_file`, `terminal` |

危险/受限工具用 `check_fn` 做前置条件检查。

## 凭证操作（pass）

```bash
anima service start | stop | restart | status [--foreground] [--host HOST] [--port PORT]  # 默认 bind `127.0.0.1`（逗号可传多地址）；status health 优先探测 127.0.0.1
anima credential list
anima credential get <path> [field]
anima credential add <path> key=value ...
anima completion bash | zsh
anima --help | --version
pass insert services/discord    # 手动添加
```

LLM 通过 `list_credentials` 看到路径与元数据，**永不看到值**。详见 ARCHITECTURE §凭证。
