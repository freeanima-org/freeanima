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

- `sessions` **一行 = JSONL 第一行 `session_meta`**（含 compression、todos、clarify、tools 等）
- `messages` **只追加**；扩展字段进 `payload` JSONB，**Slice A 不升列**
- 领域类型复用 kernel Zod `discriminatedUnion`；Drizzle 管 DDL + migration
- JSONB 列：`schema/jsonb/` 定义 Zod + `$type<>`（`rolePayload` discriminated union、`platformInfo` 等）；`drizzle-orm/zod` 生成表级 schema（`schema/zod-schemas.ts`）
- 类型桥接：`rowToMessage` / `messageToInsert` / `rowToSessionMeta`

### 表结构

#### `sessions`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PK | 会话名（= JSONL 文件名） |
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
| `id` | TEXT PK | 全局唯一行 id（UUID；PG 主键） |
| `session_id` | TEXT FK → sessions.id | |
| `pos` | BIGINT | 会话内单调序号（平替 JSONL `id`；compression l2/l3 指向此值） |
| `content` | TEXT | |
| `ts` | TIMESTAMPTZ | 原 timestamp |
| `role_payload` | JSONB | `discriminatedUnion("role")`：user / assistant / tool 及差异字段 |

唯一索引：`(session_id, pos)`。领域层读写时 `id` 仍指 session 内 pos，与 JSONL 一致。

### 配置

```yaml
database:
  url: postgresql://user:pass@localhost:5432/anima
  # 或 pass:services/postgres/anima
```

生产环境必须配置 `database.url`。历史 `sessions/*.jsonl` 用 `migrate:jsonl` 导入，运行时不再读写 L1 JSONL。

### 迁移

1. `pnpm --filter @freeanima/db db:migrate` — schema（含 `messages.id` 全局 UUID + `messages.pos` 会话序号）
2. `DATABASE_URL=… pnpm --filter @freeanima/db migrate:jsonl` — 历史 JSONL 导入（可重复执行；仅进度 + 末行统计，失败才打印明细）

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
  pnpm --filter @freeanima/db db:migrate

# database:
#   url: pass:services/postgres/anima
```

默认：**PostgreSQL 17**、仅 `localhost` 监听、`scram-sha-256` 本地 TCP、`anima` 专用库/用户。

#### 集成测试（本机，非 pre-commit）

需 **Docker** 运行中。`pnpm test:integration` 会通过 Testcontainers 起临时 PostgreSQL 17、跑 migration，并执行全仓 `packages/**/tests/integration/`。

```bash
pnpm test:integration
```

单元测试（mapper，不连 PG）：`pnpm --filter @freeanima/db test`

## Slice B（规划中）

memory.md v2 定稿后：semantic / limbic / procedural 等表**直接落 PG**，跳过 facts 临时表。详见 [`memory.md`](memory.md) §三。
