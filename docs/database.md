# 数据库设计

> PostgreSQL 存储层。当前实施 **Slice A**（L1 Session）；L3 及 memory v2 见 **Slice B**（规划中）。
> 关联：[`compression.md`](compression.md)、[`memory.md`](memory.md)、[`sleep.md`](sleep.md)。

## 状态

| 阶段        | 范围                                        | 状态       |
| ----------- | ------------------------------------------- | ---------- |
| **Slice A** | `sessions` + `messages`（L1 主存 PG）       | **已完成** |
| **Slice B** | semantic / limbic / procedural（memory v2） | 规划中     |

代码真相源：[`kernel/db/src/schema/`](../kernel/db/src/schema/)。

## PG 多域架构（路径 C）

| 包                            | 职责                                                             |
| ----------------------------- | ---------------------------------------------------------------- |
| `@freeanima/kernel-db`        | PG 表 DDL、migration、JSONB 存储 Zod（**L1 类型真源**）          |
| `@freeanima/kernel`           | `SessionStorePort`、`PgRepositories` 端口；`Kernel.repos` 挂载点 |
| `@freeanima/connectors-db-pg` | `PgSessionStore` 实现、连接池、mapper、repo                      |
| `@freeanima/kernel-schemas`   | 领域便利类型；L1 重叠部分从 `kernel-db` **派生**                 |

装配：`service/serve.ts` 调用 `createPgRepositories` → `kernel.setRepositories`。engine / life 经 `getKernel().repos.session` 读写，不直接依赖 connector。

新增 PG 域（memory / cron / task）：`kernel-db/schema/{domain}` → `kernel/ports` → `connectors-db-pg` 实现 → `PgRepositories` 扩展字段。

---

## Slice A：L1 Session（2 表）

### 设计原则

- `sessions` **一行 = `session_meta`**（含 compression、todos、clarify、tools 等）
- `messages` **只追加**；`payload` JSONB 存 `MessagePayload`（无 `pos`）；`pos` 列是会话内序号真相源
- **存储 Zod 以 `kernel-db` 为准**；`kernel-schemas` 派生 `ConversationMessage` 等领域视图
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

| 列           | 类型                  | 说明                                                               |
| ------------ | --------------------- | ------------------------------------------------------------------ |
| `id`         | TEXT PK               | 全局唯一行 id（UUID）                                              |
| `session_id` | TEXT FK → sessions.id |                                                                    |
| `pos`        | BIGINT                | 会话内单调序号（compression l2/l3 指向此值；领域层 `Message.pos`） |
| `payload`    | JSONB                 | `ConversationPayload`（role/content/tool_calls 等，**不含 pos**）  |

唯一索引：`(session_id, pos)`。

### 配置

```yaml
database:
  url: postgresql://user:pass@localhost:5432/anima
  # 或 pass:services/postgres/anima
```

生产环境必须配置 `database.url`。

### 迁移

`bun run --filter @freeanima/kernel-db db:migrate` — 应用 Drizzle migration（含列化 → payload JSONB 的数据回填）。

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
  bun run --filter @freeanima/kernel-db db:migrate

# database:
#   url: pass:services/postgres/anima
```

默认：**PostgreSQL 17**、仅 `localhost` 监听、`scram-sha-256` 本地 TCP、`anima` 专用库/用户。

#### 集成测试（本机，非 pre-commit）

需 **Docker** 运行中。`bun test` 会通过 Docker CLI 起临时 PostgreSQL 17、跑 migration，并执行根目录 `tests/integration/`（与单元测试一并运行）。

```bash
bun test
```

单元测试（mapper，不连 PG）：`bun test kernel/db`

## Slice B（规划中）

memory.md v2 定稿后：semantic / limbic / procedural 等表**直接落 PG**，跳过 facts 临时表。详见 [`memory.md`](memory.md) §三。
