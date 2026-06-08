# 数据库设计

> PostgreSQL 存储层。**Slice A**（对话存档）、**Slice B**（`semantic_memory` + `limbic_memory`）、**Slice C**（自我层 + 自传体）已落地；独立 `procedural` 表尚未建（程序记忆现用 `semantic_memory.type=procedural`）。
> 关联：[`compression.md`](compression.md)、[`memory.md`](memory.md)、[`sleep.md`](sleep.md)。

## 状态

| 阶段        | 范围                                                           | 状态                                            |
| ----------- | -------------------------------------------------------------- | ----------------------------------------------- |
| **Slice A** | `sessions` + `messages`（对话主存 PG）                         | **✅ 已完成**                                   |
| **Slice B** | `semantic_memory`、`limbic_memory`                             | **✅ 已完成**（独立 procedural 表见 Issue #41） |
| **Slice C** | `self_blocks` + `autobiographical_memory`（自我层 + 自传叙事） | **✅ 已完成**                                   |

代码真相源：[`engine/db/src/schema/`](../engine/db/src/schema/)。

## PG 多域架构（路径 C）

| 包                               | 职责                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `@freeanima/engine-db`           | PG 表 DDL、migration、JSONB 存储 Zod 与 Slice A **领域类型**（`schema/` + `domain/`） |
| `@freeanima/engine-repos`        | `SessionStorePort`、`PgRepositories` 等仓储**端口**；`null*` 适配器                   |
| `@freeanima/engine-conversation` | 会话运行时；re-export `engine-db/domain` 便利类型                                     |
| `@freeanima/connectors-db-pg`    | `PgSessionStore` 实现、连接池、mapper、repo                                           |

装配：[`service/service/src/serve.ts`](../service/service/src/serve.ts) 调用 `createPgRepositories` → `createEngine({ repos })` → `createConversationService(engine.repos)` → `initServiceContext`。运行时对话存档读写经 `getServiceContext().conversation` 或显式 `ConversationService` / `SessionStorePort`，不直接依赖 connector。

新增 PG 域（memory / cron / task）：`engine-db/schema/{domain}` → `engine-repos` 增端口 → `connectors-db-pg` 实现 → `PgRepositories` 扩展字段 → `serve.ts` 装配。

---

## Slice A：Session（2 表）

### 设计原则

- `sessions` **一行 = `session_meta`**（含 compression、todos、clarify、tools 等）
- `messages` **只追加**；`payload` JSONB 存 `MessagePayload`（无 `pos`）；`pos` 列是会话内序号真相源
- **存储 Zod 以 `engine-db/schema` 为准**；领域便利类型见 `engine-db/domain`（`engine-conversation` re-export）
- Drizzle 管 DDL + migration；`sessions` 仍列化常用 meta 字段
- 读写：`connectors-db-pg` mapper（`pos` 列 + payload 合并为 `ConversationMessage`）

### 表结构

#### `sessions`

| 列                 | 类型          | 说明                                                                                         |
| ------------------ | ------------- | -------------------------------------------------------------------------------------------- |
| `id`               | TEXT PK       | 会话名                                                                                       |
| `model`            | TEXT NOT NULL |                                                                                              |
| `title`            | TEXT          |                                                                                              |
| `cwd`              | TEXT          |                                                                                              |
| `system_prompt`    | TEXT          |                                                                                              |
| `platform_info`    | JSONB         | `discriminatedUnion("platform")`：parlor / discord / weixin / studio-pair-programming / cron |
| `compression`      | JSONB         | `{ l2, l3, summary?, summary_at? }` — **压缩边界**（见 [`compression.md`](compression.md)）  |
| `todos`            | JSONB         | `{ items, next_id }`                                                                         |
| `awaiting_clarify` | JSONB         | clarify 暂停状态                                                                             |
| `acp_sessions`     | JSONB         | ACP session uuid 映射                                                                        |
| `tools`            | JSONB         | OpenAI tools 快照                                                                            |
| `functions`        | JSONB         | string[]                                                                                     |
| `debug`            | BOOLEAN       |                                                                                              |
| `created_at`       | TIMESTAMPTZ   |                                                                                              |
| `updated_at`       | TIMESTAMPTZ   |                                                                                              |

#### `messages`

| 列            | 类型                  | 说明                                                                      |
| ------------- | --------------------- | ------------------------------------------------------------------------- |
| `id`          | TEXT PK               | 全局唯一行 id（UUID）                                                     |
| `session_id`  | TEXT FK → sessions.id |                                                                           |
| `pos`         | BIGINT                | 会话内单调序号（compression l2/l3 指向此值；领域层 `Message.pos`）        |
| `payload`     | JSONB                 | `ConversationPayload`（role/content/tool_calls 等，**不含 pos**）         |
| `content_fts` | TSVECTOR（生成列）    | STORED；`to_tsvector('simple', message_fts_input(content))`；CJK 按字切分 |

唯一索引：`(session_id, pos)`。

全文索引：`messages_content_fts_gin`（GIN on `content_fts`）。供 `recall` 历史对话检索；过滤规则：排除 tool 消息与空 content。

### 配置

```yaml
database:
  url: postgresql://user:pass@localhost:5432/anima
  # 或 pass:services/postgres/anima
```

生产环境必须配置 `database.url`。

**驱动（PoC）**：`DATABASE_DRIVER=bun` 启用 `Bun.sql` + `drizzle-orm/bun-sql/postgres`；默认 `postgres`（postgres.js）。Bun 驱动下 Drizzle 1.0.0-rc.3 的 RQB 查询仍有兼容问题，完整切换前需上游修复或升级；见 `tests/integration/db/bun-sql-driver.test.ts`。

### 迁移

- **✅ 生产**：`anima service` 启动且 PG 为主存时，[`serve.ts`](../service/service/src/serve.ts) 自动调用 `runMigrations()`。
- **手动**：`bun run --filter @freeanima/engine-db db:migrate` — 应用 Drizzle migration（含列化 → payload JSONB 的数据回填）。

### 运维

- Schema 变更：`drizzle-kit generate` + `migrate`（已应用 migration 不修改）
- **migration 不替代备份**；继续每日全盘备份；destructive 变更前 `pg_dump`

#### 本机 PostgreSQL（Debian）

```bash
# 安装 + 创建 anima 库/用户 + 生产向 conf.d 片段（需 sudo）
sudo ./scripts/setup-postgres-debian.sh

# 凭证写入 pass（脚本会打印 anima credential add … 命令）
anima credential add services/postgres/anima url=… host=… password=… database=anima

# Schema
DATABASE_URL="$(anima credential get services/postgres/anima url)" \
  bun run --filter @freeanima/engine-db db:migrate

# database:
#   url: pass:services/postgres/anima
```

默认：**PostgreSQL 17**、仅 `localhost` 监听、`scram-sha-256` 本地 TCP、`anima` 专用库/用户。

#### 集成测试（本机，非 pre-commit）

需 **Docker** 运行中。`bun test` 会通过 Docker CLI 起临时 PostgreSQL 17、跑 migration，并执行根目录 `tests/integration/`（与单元测试一并运行）。

```bash
bun test
```

单元测试（mapper，不连 PG）：`bun test connectors/db-pg`

## Slice B：semantic_memory（已落地）

### 表结构

| 列                | 类型               | 说明                                                                 |
| ----------------- | ------------------ | -------------------------------------------------------------------- |
| `id`              | TEXT PK            | 保留 `f-{seq}-{hex}` 格式                                            |
| `type`            | TEXT               | `world/experience/opinion/observation/preference/procedural/imprint` |
| `pinned`          | BOOLEAN            | 常驻记忆优先注入                                                     |
| `content`         | TEXT               | 记忆正文                                                             |
| `content_fts`     | TSVECTOR（生成列） | `to_tsvector('simple', message_fts_input(content))` STORED           |
| `source_sessions` | TEXT[]             | 来源 session ID 列表，默认 `'{}'`                                    |
| `observed_at`     | TIMESTAMPTZ        | 首次观察到该事实的时间；旧行回填 `created`                           |
| `occurred_at`     | TEXT               | 事实内容中的模糊发生时间                                             |
| `status`          | TEXT               | `active` / `deprecated`，默认 `active`                               |
| `created`         | TIMESTAMPTZ        |                                                                      |
| `updated`         | TIMESTAMPTZ        |                                                                      |

索引：`idx_semantic_memory_fts`（GIN）、`idx_semantic_memory_type`、`idx_semantic_memory_pinned`、`idx_semantic_memory_source_sessions`（GIN）、`idx_semantic_memory_status`。

端口方法：`create` / `update`（覆盖式，未传不变；`source_sessions: []` 可清空）/ `deprecate` / `listBySourceSessions` / `search` / `searchFts`；`listResident` 与 recall 默认 `status=active`。

端口：`SemanticMemoryStorePort`（`engine-repos`）→ `PgSemanticMemoryStore`（`connectors-db-pg`）→ `registerSemanticMemoryStore`（`life-memory`）。

### 从文件系统迁移

一次性脚本（读取旧 `f-*.md`，幂等 INSERT）：

```bash
DATABASE_URL="$(anima credential get services/postgres/anima url)" \
  bun run scripts/migrate-semantic-memory.ts [--dry-run] [--home ~/.anima]
```

旧 `~/.anima/memory/f-*.md` 与 `~/.anima/index/l3.db` 为**遗留路径**（非运行时）；迁移验证后可手动归档。

`limbic_memory` 见下文 §Slice C 同文件后续节；独立 `procedural` 表见 [Issue #41](https://github.com/freeanima-org/freeanima/issues/41)。

## Slice C：自我层与自传体（已落地）

### `self_blocks`（自我层六块）

| 列           | 类型        | 说明                                                                                                                 |
| ------------ | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `block_key`  | TEXT PK     | `existence_anchor` / `self_model` / `personality_baseline` / `direction` / `metacognition` / `autobiography_summary` |
| `content`    | TEXT        | Markdown 正文                                                                                                        |
| `locked`     | BOOLEAN     | `existence_anchor` 默认 true；update 需 `force`                                                                      |
| `version`    | INTEGER     | 变更计数                                                                                                             |
| `updated_by` | TEXT        | `seed` / `manual` / `tool` / `autobiography_cron` 等                                                                 |
| `created_at` | TIMESTAMPTZ |                                                                                                                      |
| `updated_at` | TIMESTAMPTZ |                                                                                                                      |

端口：`SelfLayerStorePort`（`engine-repos`）→ `PgSelfLayerStore`（`connectors-db-pg`）→ `registerSelfLayerStore`（`life-self`）。

方法：`getBlock` / `listBlocks` / `upsertBlock` / `updateBlock`（`locked` 块需 `force`）。

运行时由 `loadSelfLayerPrompt()` 读取；维护通过 `get_self_blocks` / `update_self_block` 或直接写表。

### `autobiographical_memory`（自传体叙事，记忆层）

| 列                | 类型        | 说明                                                                  |
| ----------------- | ----------- | --------------------------------------------------------------------- |
| `id`              | TEXT PK     | UUID                                                                  |
| `title`           | TEXT        | 叙事标题                                                              |
| `content`         | TEXT        | 叙事正文（只追加，无 update）                                         |
| `significance`    | TEXT        | `normal` / `milestone` / `turning_point`                              |
| `period_start`    | TEXT        | 模糊时间起点                                                          |
| `period_end`      | TEXT        | 模糊时间终点                                                          |
| `source_facts`    | TEXT[]      | 关联 `semantic_memory.id`（PG 列名；领域层 `source_semantic_memory`） |
| `source_sessions` | TEXT[]      | 关联 session id                                                       |
| `status`          | TEXT        | `active` / `deprecated`                                               |
| `created_at`      | TIMESTAMPTZ |                                                                       |
| `updated_at`      | TIMESTAMPTZ | deprecate 时更新                                                      |

索引：`status`、`significance`、`updated_at`、`source_facts`（GIN）、`source_sessions`（GIN）。

端口：`AutobiographicalMemoryStorePort` → `PgAutobiographicalMemoryStore` → `registerAutobiographicalMemoryStore`（`life-memory`）。

方法：`create` / `get` / `deprecate` / `count` / `listActive` / `listCreatedSince` / `listBySourceSemanticMemory` / `listBySourceSessions`（**无** content `update`）。

维护：`builtin-self-autobiography` cron（04:00 CST）从 `experience`/`imprint` 语义记忆叙事加工；`autobiography_summary` 块由同一任务从本表压缩刷新。

Migration：[`engine/db/migrations/20260607150000_self_and_autobiographical/migration.sql`](../engine/db/migrations/20260607150000_self_and_autobiographical/migration.sql)。

### `limbic_memory`（边缘系统情感记忆）

| 列                    | 类型        | 说明                                       |
| --------------------- | ----------- | ------------------------------------------ |
| `id`                  | UUID PK     |                                            |
| `session_id`          | TEXT        | 关联 session                               |
| `kind`                | TEXT        | `session_mood` / `turning_point` / `spike` |
| `valence`             | REAL        | 效价 -1.0 到 1.0                           |
| `arousal`             | REAL        | 唤醒度 0.0 到 1.0                          |
| `content`             | TEXT        | 第一人称情感描述                           |
| `intensity`           | REAL        | 强度 0.0 到 1.0，默认 0.5                  |
| `source_segment`      | TEXT        | early / mid / late 或具体位置              |
| `semantic_memory_ids` | TEXT[]      | 关联 `semantic_memory.id`                  |
| `created_at`          | TIMESTAMPTZ |                                            |

索引：`semantic_memory_ids`（GIN）、`session_id`、`created_at`、`kind`、`intensity`、`valence`、`arousal`。

端口：`LimbicMemoryStorePort` → `PgLimbicMemoryStore` → `registerLimbicMemoryStore`（`life-memory`）。

方法：`create` / `get` / `listBySession`。**不注入** system prompt；浅睡 Phase 2 经 `create_limbic_memory` 写入。

Migration：[`engine/db/migrations/20260607160000_limbic_memory/migration.sql`](../engine/db/migrations/20260607160000_limbic_memory/migration.sql)。

## cron_jobs（已落地）

定时任务元数据 PG 存储；output 正文仍在 `~/.anima/cron/output/`（`last_output_ref` 存相对 `FREEANIMA_HOME` 的路径）。

### 表结构

| 列                 | 类型        | 说明                                            |
| ------------------ | ----------- | ----------------------------------------------- |
| `id`               | TEXT PK     | 16 hex 或 `builtin-*`                           |
| `name`             | TEXT        | 任务名称                                        |
| `schedule`         | TEXT        | CST 语义调度表达式（cron / interval / oneshot） |
| `prompt`           | TEXT        | LLM 提示词                                      |
| `skills`           | TEXT[]      | 技能列表                                        |
| `script`           | TEXT        | 脚本路径（相对 `cron/scripts`）                 |
| `no_agent`         | BOOLEAN     | 仅脚本/builtin，不调用 LLM                      |
| `enabled_toolsets` | TEXT[]      | 启用工具集                                      |
| `model_provider`   | TEXT        | 模型 provider                                   |
| `model_name`       | TEXT        | 模型名                                          |
| `workdir`          | TEXT        | 工作目录                                        |
| `context_from`     | TEXT[]      | 上游任务 ID                                     |
| `deliver`          | TEXT        | 投递目标                                        |
| `timeout_sec`      | INTEGER     | 超时秒数                                        |
| `builtin`          | BOOLEAN     | 内置任务                                        |
| `repeat`           | INTEGER     | 最大运行次数                                    |
| `run_count`        | INTEGER     | 已运行次数                                      |
| `paused`           | BOOLEAN     | 暂停状态                                        |
| `created_at`       | TIMESTAMPTZ |                                                 |
| `updated_at`       | TIMESTAMPTZ |                                                 |
| `last_run_at`      | TIMESTAMPTZ | 上次运行时间                                    |
| `last_output_ref`  | TEXT        | output 文件相对 `FREEANIMA_HOME` 路径           |

索引：`idx_cron_jobs_paused`。

调度：`Bun.cron` 进程内调度；5 段 cron 校验与 `next_run_at` 均经 `Bun.cron.parse`（注册前 CST→UTC 转换）。`next_run_at` 不入库，API 层实时计算。

端口：`CronJobStorePort`（`engine-repos`）→ `PgCronJobStore`（`connectors-db-pg`）→ `initCronModule`（`connectors-cron` / `serve.ts`）。

Migration：[`engine/db/migrations/20260607140000_cron_jobs/migration.sql`](../engine/db/migrations/20260607140000_cron_jobs/migration.sql)（手写 SQL，无 Drizzle schema 文件）。

### 从 jobs.json 迁移

一次性脚本（幂等 `ON CONFLICT DO NOTHING`）：

```bash
DATABASE_URL="$(anima credential get services/postgres/anima url)" \
  bun run scripts/migrate-cron-to-pg.ts [--dry-run] [--home ~/.anima]
```

旧 `~/.anima/cron/jobs.json` 为遗留路径；迁移验证后可手动归档。

## tasks（已落地）

跨 session 持久待办；`status` / `priority` 为 TEXT + Zod enum（`engine-db/schema/tasks.ts`）。

| 列                  | 类型        | 说明                                                  |
| ------------------- | ----------- | ----------------------------------------------------- |
| `id`                | TEXT PK     | UUID                                                  |
| `title`             | TEXT        | 标题                                                  |
| `description`       | TEXT        | 详情（可选）                                          |
| `status`            | TEXT        | pending / in_progress / completed / cancelled         |
| `priority`          | TEXT        | high / medium / low / none                            |
| `due_at`            | TIMESTAMPTZ | 截止时间（可选）                                      |
| `created_at`        | TIMESTAMPTZ |                                                       |
| `updated_at`        | TIMESTAMPTZ |                                                       |
| `completed_at`      | TIMESTAMPTZ | 完成/取消时间（可选）                                 |
| `source_session_id` | TEXT FK     | 创建来源 session（`sessions.id`，ON DELETE SET NULL） |

索引：`idx_tasks_status`、`idx_tasks_list`（status, priority, created_at）。

端口：`TaskStorePort`（`engine-repos`）→ `PgTaskStore`（`connectors-db-pg`）→ `capabilities/tasks` 工具。

Migration：[`engine/db/migrations/20260608120000_tasks/migration.sql`](../engine/db/migrations/20260608120000_tasks/migration.sql)。
