# 数据库设计

> PostgreSQL 存储层。当前实施 **Slice A**（L1 Session）；L3 及 memory v2 见 **Slice B**（规划中）。
> 关联：[`compression.md`](compression.md)、[`memory.md`](memory.md)、[`sleep.md`](sleep.md)。

## 状态

| 阶段        | 范围                                                    | 状态                          |
| ----------- | ------------------------------------------------------- | ----------------------------- |
| **Slice A** | `sessions` + `messages`（L1 主存 PG）                   | **已完成**                    |
| **Slice B** | `semantic_memory`（语义记忆）；limbic / procedural 待建 | **进行中**（semantic 已落地） |

代码真相源：[`engine/db/src/schema/`](../engine/db/src/schema/)。

## PG 多域架构（路径 C）

| 包                               | 职责                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `@freeanima/engine-db`           | PG 表 DDL、migration、JSONB 存储 Zod 与 L1 **领域类型**（`schema/` + `domain/`） |
| `@freeanima/engine-repos`        | `SessionStorePort`、`PgRepositories` 等仓储**端口**；`null*` 适配器              |
| `@freeanima/engine-conversation` | 会话运行时；re-export `engine-db/domain` 便利类型                                |
| `@freeanima/connectors-db-pg`    | `PgSessionStore` 实现、连接池、mapper、repo                                      |

装配：[`service/service/src/serve.ts`](../service/service/src/serve.ts) 调用 `createPgRepositories` → `createEngine({ repos })` → `createConversationService(engine.repos)` → `initServiceContext`。运行时 L1 读写经 `getServiceContext().conversation` 或显式 `ConversationService` / `SessionStorePort`，不直接依赖 connector。

新增 PG 域（memory / cron / task）：`engine-db/schema/{domain}` → `engine-repos` 增端口 → `connectors-db-pg` 实现 → `PgRepositories` 扩展字段 → `serve.ts` 装配。

---

## Slice A：L1 Session（2 表）

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
| `compression`      | JSONB         | `{ l2, l3, summary?, summary_at? }`                                                          |
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

全文索引：`messages_content_fts_gin`（GIN on `content_fts`）。供 `recall` 历史对话检索；过滤规则与旧 L2 蒸馏一致（排除 tool 消息与空 content）。

### 配置

```yaml
database:
  url: postgresql://user:pass@localhost:5432/anima
  # 或 pass:services/postgres/anima
```

生产环境必须配置 `database.url`。

### 迁移

`bun run --filter @freeanima/engine-db db:migrate` — 应用 Drizzle migration（含列化 → payload JSONB 的数据回填）。

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

| 列            | 类型               | 说明                                                                 |
| ------------- | ------------------ | -------------------------------------------------------------------- |
| `id`          | TEXT PK            | 保留 `f-{seq}-{hex}` 格式                                            |
| `type`        | TEXT               | `world/experience/opinion/observation/preference/procedural/imprint` |
| `pinned`      | BOOLEAN            | 常驻记忆优先注入                                                     |
| `content`     | TEXT               | 记忆正文                                                             |
| `content_fts` | TSVECTOR（生成列） | `to_tsvector('simple', message_fts_input(content))` STORED           |
| `created`     | TIMESTAMPTZ        |                                                                      |
| `updated`     | TIMESTAMPTZ        |                                                                      |

索引：`idx_semantic_memory_fts`（GIN）、`idx_semantic_memory_type`、`idx_semantic_memory_pinned`。

端口：`SemanticMemoryStorePort`（`engine-repos`）→ `PgSemanticMemoryStore`（`connectors-db-pg`）→ `registerSemanticMemoryStore`（`life-memory`）。

### 从文件系统迁移

一次性脚本（读取旧 `f-*.md`，幂等 INSERT）：

```bash
DATABASE_URL="$(anima credential get services/postgres/anima url)" \
  bun run scripts/migrate-semantic-memory.ts [--dry-run] [--home ~/.anima]
```

旧 `~/.anima/memory/f-*.md` 与 `~/.anima/index/l3.db` 迁移验证后可手动归档。

### 待建（Slice B 余下）

limbic / procedural 等待 memory v2 定稿后继续落 PG。详见 [`memory.md`](memory.md) §三。
