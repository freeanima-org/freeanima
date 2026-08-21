---
title: 服务
---

# 服务运维

> 运行时状态、内存指标与常用命令。

在栖息地聊天中，agent 可按需加载 ToolSet **`ops`**
（`toolset_load(["ops"])`），用于健康 / 状态、脱敏配置，以及经伙伴确认的配置补丁 / 重启 — 见
[`docs/tools/ops.md`](../tools/ops.md)。

## 状态与内存指标

`anima service status` 与 `createTypedHabitatClient().call("status.get")`
（REST `GET /rpc/v1/status/get`）在 `memory_kb` 与 `memory_detail` 下报告进程内存。

| 字段 / 标签                   | 来源                                               | 含义                                                   |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| `rss (phys)` / `memory_kb`    | Linux `VmRSS`，或 `process.memoryUsage().rss` 回退 | 进程当前驻留的物理 RAM                                 |
| `heap (jsc)` / `heap_used_kb` | `process.memoryUsage().heapUsed`                   | JavaScriptCore 堆统计（非 OS 物理内存）                |
| `native` / `external_kb`      | `process.memoryUsage().external`                   | 绑定到 JS 的原生对象                                   |
| `virtual` / `vm_size_kb`      | Linux `VmSize`                                     | 预留的虚拟地址空间（Gigacage 隔离区）；非实际 RAM 占用 |

在 Bun + JavaScriptCore 上，`heap (jsc)` 可能**远大于** `rss (phys)`。问「anima 占多少
RAM？」请看 RSS。JS 压力看 heap 趋势（随时间、GC 后）——不要与 RSS 做绝对值对比。

请在 shell 中验证（业务 API 需要 Service API Token——见
[`remote-access.md`](remote-access.md)）：

```bash
curl -s -H "Authorization: Bearer <fa_at_...>" http://127.0.0.1:2658/rpc/v1/status/get | jq '.memory_kb, .memory_detail'
grep -E '^(VmRSS|VmSize):' /proc/$(pgrep -f 'anima service' | head -1)/status
just misc memory-sample -- --habitat-url http://127.0.0.1:2658 --stage full
```

## 开发 vs 生产

| 模式                    | 如何运行栖息地                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Monorepo / worktree** | `just dev habitat`（默认随机端口 ≥10000；可选 `--port` / `--strict-port`；源码树 `anima` **无** `service` 命令） |
| **独立安装版**          | `anima service start` / `stop` / `status`（systemd user unit；**2658** / TLS **2659**；**仅 Linux x64**）        |

Windows 源码开发走 monorepo 路径（`just dev` / `just dev habitat`）；没有 Windows 版
`anima service` 二进制 — 见 [`windows-dev.md`](windows-dev.md)。

Discord / 微信消息网关的配置见 [`message-gateway.md`](message-gateway.md)。

## 连接与能力层

每条 `connections.<id>` 是一条 **连接**（凭证 + 端点）。内置预设可覆盖多层模态；自定义只落一层。

| 概念     | 配置                    | 含义                                                                                                                 |
| -------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 连接     | `connections.<id>`      | 内置：`preset` ∈ deepseek / openrouter / opencode_go / alibaba_token_plan / ollama；自定义：`custom` + `custom_kind` |
| 文本协议 | `text_protocol`         | Completions / Responses / Messages；仅自定义文本层可改                                                               |
| 能力段   | 五个顶层键              | `text_generate` / `image_generate` / `audio_generate` / `video_generate` / `embedding`                               |
| 绑定     | `{ connection, model }` | 子场景省略或 `null` = 同 main。文本子场景：summary / reflect / goal_judge / skill_review；音频：tts / voice_realtime |
| 视频     | `video_generate.main`   | 可配置、不接入 media / 引擎                                                                                          |

设置侧栏：**连接 | 文本生成 | 图片生成 | 音频生成 | 视频生成 | 文本嵌入**。无「自定义方案」Tab。

- **单格式预设**（`deepseek`、`openrouter`）：固定文本协议 + 默认 `base_url`（不落盘）。
- **多格式网关预设**（`opencode_go`）：base 为 `https://opencode.ai/zen/go/v1`；格式**按模型**选择。
- **阿里云 Token Plan**：厂商协议（`alibaba_multimodal` / `alibaba_audio`），不必 OpenAI 封装；不出现在自定义协议下拉。
- **Ollama**（自建）：对话 `openai_compatible` + 向量 `openai_embeddings`；默认 `http://127.0.0.1:11434/v1`，**可改** `base_url`（局域网/远程）；`api_key` 填占位即可（如 `ollama`）。不声明文生图 / TTS / 视频（与产品 Images/Speech 协议不对齐）。视觉理解走对话多模态模型。
- **Custom**：只选一层通用协议 + `base_url`。无 `format` / `backend` 别名。
- **没有**内置 `openai` 预设。
- **API 密钥**：配置中明文，或 `vault(...)` / `env(...)` 引用。设置 UI **不会**自动掩码密钥。
- **`summary` 子场景**：会话压缩与会话标题生成共用（引擎 `PROFILE_SUMMARY`）。

### models.dev 元数据

[models.dev](https://models.dev) 是开放的模型限额、定价与能力目录。FreeAnima 经 `@opencode-ai/models` 加载（实时 `/api.json`，快照回退），用于：

1. **目录 enrichment** — Connection `GET /models` 之后，id 匹配时合并 context / max output / 显示名 / 每百万 token USD 成本（连接侧非默认限额优先于 models.dev）。
2. **`getModel` 回退** — Anthropic Messages / OpenAI Responses / 不稳定的兼容网关若缺少真实目录，在 id 已知时用 models.dev，而非盲目默认 128k。
3. **压缩 context** — 目录 `contextWindow`（可能已 enrichment）是 token 压缩预算的唯一窗口来源；lookup 失败则回退消息数模式（见 [`compression.md`](../cognition/compression.md)）。
4. **方案模型选择器** — 设置 → 栖息地 → 各能力层：经 RPC `config.listProviderModels` 浏览 / 搜索模型（优先连接目录；`/models` 为空时用 models.dev 的预设切片）。仍允许自由输入模型 id。

**范围外：** models.dev 不替代连接凭证或端点；不计量计费；能力标志仅为提示，非运行时保证。

### 超时

`connections.<id>` 支持四层超时（聊天走流式 HTTP；embedding 仍只用 `timeout_ms` + `connect_timeout_ms`）：

| 字段                    | 默认                | 含义                                      |
| ----------------------- | ------------------- | ----------------------------------------- |
| `timeout_ms`            | `600000`（10 分钟） | 整体墙钟：请求开始 → 结束                 |
| `connect_timeout_ms`    | `10000`             | 连接 / HTTP 响应头；端点不可达快失败      |
| `first_byte_timeout_ms` | `30000`             | 首个流式 chunk（生成开始，不是 TCP）      |
| `idle_timeout_ms`       | `120000`            | chunk 空闲（仅流式）；必须 ≤ `timeout_ms` |

`connect_timeout_ms` / `first_byte_timeout_ms` / `idle_timeout_ms` 也必须 ≤ `timeout_ms`。超时仍映射为
`ProviderErrorCode=timeout`（消息含 `connect` / `first_byte` / `overall` / `idle`）。

## 常用命令

```bash
# --- 仅独立安装版 CLI ---
anima service start          # background (systemd user unit when available)
anima service start --foreground
anima service status
anima service stop
anima service restart

# --- monorepo / worktree ---
just dev                     # Habitat (≥10000) + Vite Web (≥5000); proxy via FREEANIMA_URL
just dev habitat              # Habitat foreground + debounce 硬重启（默认）；FREEANIMA_HABITAT_WATCH=0 可关；random ≥10000; skip Habitat TLS
just dev web              # Vite HMR from :5000 (set FREEANIMA_URL to Habitat); browser Habitat = page origin
```

`anima.service` 是 **单 unit 栈**：栖息地（`:2658`，REST + SAP + 有 dist 时托管 `/web`）由一个前台 supervisor 管理。

**`service start` 永不触发 Web 构建。** 路径：

| 模式       | 何时 `just pack web`       | UI                                                                                              |
| ---------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| 独立发行版 | `just pack cli` 时强制     | 内嵌，由 `/web/*` 提供                                                                          |
| 源码部署   | 启动前手动 `just pack web` | 有 dist 时栖息地提供 `/web/*`                                                                   |
| 开发       | 不需要                     | `just dev` / `just dev habitat`（Habitat debounce 硬重启）+ `just dev web` → Web **:5000+** HMR |

存在 Web dist（`packages/frontend/portal/app/web/dist` 或内嵌）时，栈从栖息地提供浏览器 Web UI：`http://<host>:2658/web/*`（无独立 API 代理）。客户端在 **栖息地设置** 中保存栖息地 URL 与 **Service API Token**（`fa_at_...`）。可选栖息地原生 TLS 在 `http.tls.enabled: true` 时监听 **`https://<host>:2659`**（见 [`remote-access.md`](remote-access.md)）— **仅生产**；源码 `just dev habitat` 跳过栖息地 TLS；Vite 默认 HTTP，仅 `DEV_HTTPS=1` 时终止 HTTPS。

**启动顺序：** 栖息地必须通过 `GET /rpc/v1/health/probe`（`status: ok`）之后，`serve()` 的 `onReady` 钩子才会跑。`anima service start` 默认最多等 **15 分钟**（`FREEANIMA_HABITAT_READY_TIMEOUT_MS`），因为 schema 迁移在 HTTP listen **之前**执行。远程工具宿主断线由 `@freeanima/shared/rpc-contract` 传输层重试（指数退避）。

**UI 访问：**

- **桌面 / 移动入口：** 聊天室与栖息地在 Tauri 应用内（除非有 dist 且栖息地托管 `/web`，否则不由栖息地 `:2658` 提供）。
- **浏览器 / PWA：** 有 dist 时由栖息地提供 `http://<host>:2658/web/*`。`/web/config.json` 中默认栖息地 URL 为 **页面 origin**。
- **本地 Web 开发（`just dev web`）：** Vite 从 `:5000` 起，base 为 `/web/`——聊天室
  `http://127.0.0.1:5000/web/chat`，栖息地 `…/web/habitat/dashboard`；`/rpc`
  与 `/mcp` 代理到 `FREEANIMA_URL`。浏览器栖息地默认页面 origin；`just dev habitat` 通过
  `~/.anima/dev-web.token` 自动注入 token。
