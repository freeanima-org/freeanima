---
title: 编码工作台
---

# 编码工作台

> **Coding** / **编码工作台**：入口内独立前哨窗（UI + `remote_tools.attach`），在开发机执行 FS / 终端 / patch；栖息地做脑与项目 World。与 [桌面伴侣](./companion.md) 同类前哨，**不是**第二个 App，也**不是** [项目管理](./project.md)（任务/文件夹 PM）。

## 目标

- 个人玩具 → 逐步成为 **Agent 编码**的日常主力（不是先做 Tab 补全）。
- 聊天室已能 vibe；瓶颈是**工作台 UX**（explore / patch / 多仓会话）。
- 第一阶段重心：**读仓（explore）**；写与 diff 其次。LSP / Debugger / SSH Remote 为**后续**。

## 运行拓扑

- 栖息地在**稳定弱机**（脑 + 记忆 + 编排）。
- 手在**开发机前哨**：FS / 搜索 / 终端 /（后续）patch。
- **跨机前哨是硬性要求**，不是可选项。

```text
Coding outpost window ── RPC + attach ──► weak-machine Habitat
Main Chat / tasks      ── RPC only ─────► same Habitat
```

## 产品形态

- **编码工作台 = 独立前哨窗**（UI + `remote_tools.attach`），与桌面伴侣同类；同一 **Tauri 入口**，不是第二个应用。
- 功能代码：`src/features/coding/` —— **不要**把 Coding 塞进 `features/companion/`。
- 「产品 UI 不 attach」适用于**主壳产品模块**（聊天室、任务、…）。**前哨窗可以既是 UI 又是手**。
- 保活与**伴侣进程/壳存活**对齐，但 **attach 生命周期不同**：
  - 伴侣：隐藏显示会**关闭** WebView → attach 拆除（离线）。
  - 编码：优先**隐藏不关**，使前哨保持 attach，供 Agent 工具调用。**不要**把 attach 绑到主窗生命周期。

## 连接与多仓会话

- 默认：**一次 attach，一个 `instance_id`**（一个 Coding 窗 = 一只本机手）。
- **多仓 ≠ 多实例**。Cursor 式「一个 UI、多个仓」= **多个 Agent 会话**，各锁自己的 `workspaceRoot`（一会话一根；创建后不可变）。
- 多次 attach 仅用于：多机前哨、伴侣+编码，或罕见双 Coding 窗。
- `instance_id` = 哪条本机连接；**不是**哪个仓库。

## 三层身份

| 层                   | 含义                                                     | 示例                                           |
| -------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| **`stable_key`**     | 跨机逻辑项目 id（在 **World** 上）                       | `git:github.com/org/foo`、`novel:crane-summer` |
| **项目 World**       | 该项目的知识/任务边界（建议 **public**，一项目一 World） | entity + `world_config`                        |
| **`workspace_root`** | 某机上的 checkout 路径                                   | 会话 `platform_info`；所有 FS/终端相对它       |

- 分组 / 记忆 / 任务 → World / `stable_key`
- 读文件 / 跑命令 → 当前会话 `workspace_root`
- 分开以免「同源、错目录」类 bug。

会话元数据还存 `project_world_id`。编码会话应使用 platform 字符串 `remote:coding:{instanceId}`（不是普通 `chat`）。

## World 策略

- **不要**把多仓知识倒进 Agent private（泥球），也**不要**全放 Commons。
- **Private World**：主体个性化（风格、偏好、弱项目相关）。
- **项目 Public World**：项目绑定数据（explore 笔记、该项目任务、…）；后续经 **grants** 多 agent。
- **Commons**：栖息地级共享资产（内置技能、伴侣资源），不绑单一项目。
- 壳的 User/Agent 切换仍框定日常；编码会话携带 **`project_world_id`** 上下文。

## World 上的 `stable_key`

- `world_config` body 上的通用字段：**`stable_key`**（永不叫 `repo_key`）。
- 编码可从规范化 git origin **推导**；其他领域复用前缀：`git:` / `novel:` / `manual:`。
- `title` = 可编辑显示名；`stable_key` = 机器身份，设置时**唯一**（PG 部分唯一索引 + 应用检查）。

## `.anima/project.json`（可提交）

团队可提交的最小集合：

```json
{
  "version": 1,
  "stable_key": "git:github.com/org/freeanima"
}
```

可选：`display_name`（团队规范名）。

**不要提交：** `world_id`（栖息地本地）。本地缓存（`project.local.json` 或前哨 prefs）。

有 git remote 时可省略该文件并由系统计算 key；无 remote / 非 git 项目用文件钉死 key。

**`.anima/` 边界**：仅项目身份（`project.json` 等）。**不要**放置 `skills/`、`rules/`、`agents/`、`mcp.json` — 这些由社区 `.agents/` 与厂商兼容路径承担。

## 项目 Agent 上下文（仅 Coding 模块）

栖息地**普通聊天室不**从会话 `cwd` 读 `AGENTS.md`。项目上下文**只在** `module=coding` 且有 `workspace_root` 时装配：

1. Coding 前哨在工作区扫盘发现资产
2. 经 `coding.projectContextSync` 写入栖息地会话缓存
3. system prompt / `skill_load` / `subagent_run` 叠加项目层

### 目录约定

```text
.agents/                         # 社区默认（Codex / OpenCode / Copilot 等）
  skills/<name>/SKILL.md         # agentskills.io
  rules/**/*.md
  agents/**/*.{md,agent.md}
  mcp.json
AGENTS.md                        # 社区通用项目叙事；可读写（agents_md_read / agents_md_write）
CLAUDE.md                        # Claude Code 兼容
.claude/skills | .claude/rules | .claude/CLAUDE.md
.cursor/rules/*.mdc
.opencode/skills | .opencode/agents
.mcp.json | .vscode/mcp.json | .cursor/mcp.json

.anima/
  project.json                   # 仅 identity / stable_key
```

同名资产优先级：`.agents` → 厂商路径（先声明的来源赢）。

### 项目 MCP（前哨桥）

- **发现与启停**在 Coding 前哨（开发机），**不**写入栖息地全局 `mcp_servers`
- HTTP/SSE MCP：前哨连接后把 tools `tool.register` 为 `mcp_<server>_<tool>`，栖息地经现有 remote-tools 桥调用
- stdio MCP：在 Node/Bun 前哨环境可连；纯 Tauri WebView 暂记 status（改用 HTTP 或后续壳桥）
- 工具 `project_mcp_status` 查看连接状态

## 工作台 UI（P0）

交互对标 **Cursor Agents Window**：三栏 **Agents | 对话 | Context**，深色 Agent 优先。

### 会话 × 工作区（硬约束，对接未来 worktree）

- **一对话一根工作区**：本地 `CodingAgentSession.workspaceRoot: string | null`（创建时可明确选「无工作区」）。
- **创建后不可变**：New Agent 选定路径（或无）即锁定；UI **无**添加/移除/更换文件夹。换目录 = **新建** Agent。
- **新建可选已有工作区**：本地额外持久化 `knownWorkspaces`（去重工作区路径，会话删除后仍保留）；New Agent 对话框用下拉列出这些工作区，选中即复用该根新建会话（仍是独立 `workspaceRoot` 字符串），也可「选择新文件夹」或「无工作区」。
- 栖息地 `conversation.create` 的 `workspace_root` 与本地字段一致且同样视为不可变；本地 `conversationId` 持久化后复用。
- 左栏按 `workspaceRoot` 的 basename 分组（`null` →「无工作区」）；同仓多会话 = 同组多条（为后续同仓不同 worktree 路径留口：每条仍是独立 `workspaceRoot` 字符串）。
- 本地存储 key `freeanima:coding:agent-sessions:v2`；从 v1 多根迁移时只保留 `activeRoot ?? workspaceRoots[0] ?? null`。

### 栏位

- **左栏 Agents**：Repositories 分组 + 会话列表（单行 title；悬停归档 / 删除）；Search（Ctrl/Cmd+K）；New Agent。归档为软隐藏（`archivedAt`），本轮无「已归档」入口。
- **中栏对话**：空态居中输入；有消息后线程 + 底部 follow-up；流式走 `getBundledRpcStreamClient`（**不**整包 import Chat SPA）；platform = `remote:coding:{instanceId}`。
  - **复用聊天室原子（禁止挂载 ChatApp）**：`ConversationTranscript`（**消息列表 + stick-to-bottom + 向上懒加载 SSOT**；新增气泡样式 / display 分支只改该组件，禁止 Coding 平行 `display.map`）、`slash-command-menu` / `conversation-command-api`（slash）、`stream-events` + Markdown（流式 token）、`upsert-tool-block` + `ToolBlockBubble`（经 Transcript）、`LlmDebugPanel` + `useChatLlmDebugEnabled`（LLM 调试；设置页开关与聊天室共用）。compose / 空态 hero / 三栏布局皮肤留在 Coding SPA。
  - 历史分页与聊天室同契约：`conversation.messages` 的 `before_pos` / `has_more_before` / `from_pos`。
- **右栏 Context**（默认展开）：Files（可展开树）/ Preview（Shiki）/ Terminals（`terminal_run` 输出日志；**非**交互 PTY）。
- Search Actions：**无**「更换工作区」，有「新建 Agent」。
- 理解笔记：挂在 Files 区（需 `project_world_id`）。

## 工具（P0）

前哨 `local_name`（在 Coding WebView / 薄 Rust IPC 内于**开发机**执行）：

| 工具                 | 角色                                                        |
| -------------------- | ----------------------------------------------------------- |
| `file_list`          | 只读树                                                      |
| `file_read`          | 读文件                                                      |
| `file_search`        | 搜文件/内容                                                 |
| `file_patch`         | 最小编辑（`old_string` / `new_string`）；**立即写入**工作区 |
| `terminal_run`       | 一次性命令（可选 `terminal_process`）                       |
| `project_context`    | 发现项目 agent 资产（rules / skills / agents / mcp）        |
| `agents_md_read`     | 读根 `AGENTS.md`                                            |
| `agents_md_write`    | 写根 `AGENTS.md`                                            |
| `project_mcp_status` | 前哨管理的项目 MCP 连接状态                                 |
| `mcp_*_*`            | 桥接的项目 MCP 工具                                         |

路径沙箱在会话 `workspace_root` 下。编码会话须**默认用这些前哨工具** —— **不要**静默回退到栖息地本机 `file_*`（服务器上没有你的仓）。

内置 subagent `explorer` 用栖息地 `file_*`，**不是**工作区探索器。前哨只读工具请用 `coding-explorer`。

## 分阶段

**P0（本模块）**

- Coding 前哨窗 + attach
- `workspace_root` + `project_world_id` / `stable_key`
- 只读 explore + 终端；coding-explorer subagent
- 最小 `file_patch` 立即写盘
- 理解笔记写入**项目 World**（`coding_note`），经栖息地 RPC `coding.noteCreate` / `coding.noteList`（Coding 窗「理解笔记」）

**后续**

- LSP / refactor / Debugger
- SSH Remote（同一工具契约，不同后端）
- 更重索引 / symbols
- 交互式 PTY
- Cloud / Worktree 检出与真 Git Commit&Push

## 一句话

> 弱机栖息地 = 脑 + 项目 World；本机一个 Coding 前哨窗 = 手；多仓靠会话路径 + World `stable_key`；团队仓内只钉 `stable_key`；先赢 explore + 工作台，再加深 IDE。

另见：[栖息地 RPC](../ops/habitat-rpc.md)、[架构](../product/architecture.md)、[桌面伴侣](./companion.md)、[实体模型](../product/entity-model.md)。
