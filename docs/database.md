# 数据库设计

> PostgreSQL 存储层。当前实施 **Slice A**（L1 Session）；L3 及 memory v2 见 **Slice B**（规划中）。
> 关联：[`compression.md`](compression.md)、[`memory.md`](memory.md)、[`sleep.md`](sleep.md)。

## 状态

| 阶段 | 范围 | 状态 |
|------|------|------|
| **Slice A** | `sessions` + `messages`（L1 主存 PG） | **已完成** |
| **Slice B** | semantic / limbic / procedural（memory v2） | 规划中 |

代码真相源：[`packages/db/src/schema/`](../packages/db/src/schema/)。

---

## Slice A：L1 Session（2 表）

### 设计原则

- `sessions` **一行 = `session_meta`**（含 compression、todos、clarify、tools 等）
- `messages` **只追加**；`payload` JSONB 存 `ConversationPayload`（无 `pos`）；`pos` 列是会话内序号真相源
- 领域类型复用 kernel Zod；Drizzle 管 DDL + migration
- `sessions` 仍列化常用 meta 字段
- 读写：`messageToInsert` / `rowToMessage`（`pos` 列 + payload 合并为 `ConversationMessage`）

### 表结构

#### `sessions`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PK | 会话名 |
| `model` | TEXT NOT NULL | |
| `title` | TEXT | |
| `cwd` | TEXT | |
| `system_prompt` | TEXT | |
| `platform_info` | JSONB | `discriminatedUnion("platform")`：parlor / discord / weixin / studio-pair-programming / cron |
| `compression` | JSONB | `{ l2, l3, summary?, summary_at? }` |
| `todos` | JSONB | `{ items, next_id }` |
| `awaiting_clarify` | JSONB | clarify 暂停状态 |
| `acp_sessions` | JSONB | ACP session uuid 映射 |
| `tools` | JSONB | OpenAI tools 快照 |
| `functions` | JSONB | string[] |
| `debug` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `messages`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PK | 全局唯一行 id（UUID） |
| `session_id` | TEXT FK → sessions.id | |
| `pos` | BIGINT | 会话内单调序号（compression l2/l3 指向此值；领域层 `Message.pos`） |
| `payload` | JSONB | `ConversationPayload`（role/content/tool_calls 等，**不含 pos**） |

唯一索引：`(session_id, pos)`。

### 配置

```yaml
database:
  url: postgresql://user:pass@localhost:5432/anima
  # 或 pass:services/postgres/anima
```

生产环境必须配置 `database.url`。

### 迁移

`pnpm --filter @freeanima/legacy-db db:migrate` — 应用 Drizzle migration（含列化 → payload JSONB 的数据回填）。

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
  pnpm --filter @freeanima/legacy-db db:migrate

# database:
#   url: pass:services/postgres/anima
```

默认：**PostgreSQL 17**、仅 `localhost` 监听、`scram-sha-256` 本地 TCP、`anima` 专用库/用户。

#### 集成测试（本机，非 pre-commit）

需 **Docker** 运行中。`pnpm test:integration` 会通过 Testcontainers 起临时 PostgreSQL 17、跑 migration，并执行全仓 `packages/**/tests/integration/`。

```bash
pnpm test:integration
```

单元测试（mapper，不连 PG）：`pnpm --filter @freeanima/legacy-db test`

## Slice B（规划中）

memory.md v2 定稿后：semantic / limbic / procedural 等表**直接落 PG**，跳过 facts 临时表。详见 [`memory.md`](memory.md) §三。
