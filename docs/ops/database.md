---
title: 数据库
---

# PostgreSQL 安装与运维

> FreeAnima 用 PostgreSQL 存对话归档、语义记忆、自我层及相关数据。
> 相关概念：[`memory.md`](../cognition/memory.md)、[`sleep.md`](../cognition/sleep.md)。
> 安全与凭证：[`security.md`](security.md)。

## 连接配置

在 `config.yaml` 中设置数据库 URL：

```yaml
database:
  url: postgresql://user:pass@localhost:5432/anima
  # or use env() (bootstrap cannot resolve vault() — Vault lives in PG):
  # url: env("DATABASE_URL")
```

生产环境**必须**设置 `database.url`。优先 `env("DATABASE_URL")`，避免在 `config.yaml`
中写明文密码（冷启动无法解析 Vault）。路径约定：
[`security.md`](security.md#credential-responsibilities)。

可选连接池覆盖（见
[`packages/habitat/core/db/pg/client.ts`](../../packages/habitat/core/db/pg/client.ts)）：

| Env                              | Default | 说明                                                                      |
| -------------------------------- | ------- | ------------------------------------------------------------------------- |
| `FREEANIMA_PG_POOL_MAX`          | `10`    | 连接池上限，对齐部署 `max_connections`                                    |
| `FREEANIMA_PG_POOL_IDLE_TIMEOUT` | `0`     | 秒；`0` = 关闭。Bun ≤1.3.14 勿设 `30`（会误杀长查询，见 troubleshooting） |
| `FREEANIMA_PG_POOL_MAX_LIFETIME` | `0`     | 秒；`0` = 不限制连接寿命                                                  |

## 本地安装（Docker，跨平台）

**Windows / macOS** 上推荐，Linux 也可。镜像含 **pgvector**：

```bash
docker run -d --name anima-pg \
  -e POSTGRES_USER=anima \
  -e POSTGRES_PASSWORD=anima \
  -e POSTGRES_DB=anima \
  -p 5432:5432 \
  pgvector/pgvector:pg18
```

`config.yaml`（示例）：

```yaml
database:
  url: postgresql://anima:anima@127.0.0.1:5432/anima
  # or: url: env("DATABASE_URL")
```

Windows 贡献者说明（winget、Git Bash、Redis 容器）：
[`windows-dev.md`](windows-dev.md)。

## 本地安装（Debian）

```bash
# Install PostgreSQL, create anima db/user (requires sudo)
sudo ./scripts/setup-postgres-debian.sh

# config.yaml (example):
#   url: env("DATABASE_URL")
```

默认：PostgreSQL 18，仅 `localhost`，`scram-sha-256`，专用 `anima` 库与用户。

## 扩展（一次性）

全文与向量检索需要 PostgreSQL 扩展。应用用户通常无法 `CREATE EXTENSION`；请以超级用户执行：

```bash
sudo apt install postgresql-18-pgvector   # match psql --version
sudo -u postgres psql -d anima -f core/scripts/ensure-pg-extensions.sql
```

通过 `setup-postgres-debian.sh` 全新安装的 Debian 会自动处理扩展。

## Schema 迁移

- **生产环境（推荐）：** 配置 PostgreSQL 后，`anima service` 启动时会**自动应用**待执行的 schema 迁移。
- **手动：**

```bash
DATABASE_URL="postgresql://anima:…@127.0.0.1:5432/anima" \
  just db migrate
```

安装扩展后执行，或重启 `anima service`。

## `auto_llm_runs` / `auto_llm_messages`（审计）

非对话聊天 LLM（cron agent、睡眠流水线阶段、对话标题、目标判定、压缩 / handoff 摘要）写入
`auto_llm_runs` + `auto_llm_messages`，而不是 `conversations` / `messages`。保留策略（栖息地运行时 / 壳
**设置 → 栖息地服务 → 服务配置** `auto_llm`）：

```yaml
# habitat_runtime_config fragment (not config.yaml)
auto_llm:
  retention_days: 30
  per_run_kind_keep: 100
```

在 sleep-cycle 步骤 `conversation-cleanup`（过期对话清理之后）清理；删除 run 时
`auto_llm_messages` 级联删除。Cron 脚本运行（`no_agent`）仅用 `cron_log`。

## 备份

- **迁移不能替代备份** — 请定期安排全量备份（如 `pg_dump`）。
- 破坏性变更前先备份。
- **实例集合：** PostgreSQL 必需（含 User vault，Agent 根密钥 SSOT）。按需备份
  `~/.anima/`（`FREEANIMA_HOME`）中的引导配置 / TLS / 微信等 — 见
  [`security.md`](security.md#data-persistence)。Agent 的
  `vault/agent-machine.key` 是可重建缓存（恢复后从数据维护解锁）。
- 推荐本机栈：小时级 `pg_dump` + home tar（短保留）、WAL 归档（`archive_mode`）、周级
  `pg_basebackup` 做 PITR。逻辑转储以 postgres 超级用户恢复（`pg_restore --no-owner --no-acl
--no-comments`）。
- **搜索旁表：** 可重建索引数据在 `search_documents`（不在业务 `entities` /
  `messages`）。仅业务逻辑转储可排除它，例如 `pg_dump --exclude-table-data=search_documents
…`，恢复后跑栖息地 **FTS rebuild**。要保持搜索热的完整转储应包含该表。

## 集成测试（开发者）

完整集成测试需要 **Docker** 提供临时 PostgreSQL 实例：

```bash
just qa test-integration
just qa test-integration -- --core
just qa test-integration -- tests/integration/memory/foo.test.ts
just test              # unit + integration（串行）
```

pre-commit / pre-push **不**跑 integration；PR CI 全量；功能/修 bug 主动 `--core`。

## 故障排查

| 现象                                           | 检查                                                                                                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 服务连库失败                                   | `database.url`；PostgreSQL 是否在跑；若用了 `env()` 引用是否可解析；启动错误信息会列出下一步（缺库、鉴权、连接、扩展）                                                  |
| 启动/迁移出现 `Idle timeout reached after 30s` | Bun ≤1.3.14 会误杀进行中查询（[oven-sh/bun#30646](https://github.com/oven-sh/bun/issues/30646)）。确保 `FREEANIMA_PG_POOL_IDLE_TIMEOUT=0`（默认）或临时导出该变量后重启 |
| 栖息地「未就绪」超时而进程仍在跑               | 迁移在 HTTP listen **之前**；默认等 15min（`FREEANIMA_HABITAT_READY_TIMEOUT_MS`）。看 `journalctl --user -u anima -f`，勿中途 `stop`                                    |
| 迁移失败                                       | 扩展已安装；DB 用户有 DDL 权限；HNSW / 大批量 backfill 可能很慢，勿与上述 idle timeout 混淆                                                                             |
| FTS / 关键词召回为空                           | 已执行 `ensure-pg-extensions.sql`（`pg_trgm`）；必要时 jieba/FTS rebuild                                                                                                |

更多部署安全事项：[`security.md`](security.md)。
