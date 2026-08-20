# LoCoMo Eval Adapter（风巢 #16041）

薄评测挂载：官方 LoCoMo QA × 双臂（全上下文基线 vs FreeAnima 召回），输出 **Token 节省率** 与 **质量保持率**。

> 官方数据：[snap-research/locomo](https://github.com/snap-research/locomo) `data/locomo10.json`（约 10 会话 / ~2k QA）。任务正文「5000」已过时。

## 真实指标 vs 冒烟

| 模式             | 命令要点                    | retain                   | 召回                              | 是否代表框架               |
| ---------------- | --------------------------- | ------------------------ | --------------------------------- | -------------------------- |
| **真实（推荐）** | `compose up` + 默认跑       | LLM 抽事实 → PG semantic | `MemoryService.recall` hybrid FTS | **是**（同存储 + 同召回）  |
| dry-run + PG     | `--dry-run`（仍起 compose） | 假抽取（整句入库）       | 真 FTS                            | 测接线 / Token，质量偏乐观 |
| `--memory-only`  | 不连 compose                | 假                       | 关键词 list                       | **玩具**，仅冒烟           |

**不读写用户 `~/.anima/config.yaml`。** `run.ts` 将 `FREEANIMA_HOME` 设为 `.cache/locomo/home`，评测配置只写在该目录。

## Compose（PG + Redis）

```bash
docker compose -f scripts/eval/locomo/compose.yaml up -d
# 端口：PG 55432 / Redis 56379（避开日常 5432/6379）
docker compose -f scripts/eval/locomo/compose.yaml down -v
```

## 运行

```bash
# 真实指标冒烟（需 compose；dry-run 不调外网 LLM）
docker compose -f scripts/eval/locomo/compose.yaml up -d
bun scripts/eval/locomo/run.ts --dry-run --fixture --limit 5

# 真实指标 + 真 LLM（默认 OpenCode Go）
LOCOMO_API_KEY=... bun scripts/eval/locomo/run.ts --fixture --limit 5

# 玩具冒烟（无 Docker）
bun scripts/eval/locomo/run.ts --dry-run --fixture --memory-only --limit 5

# 全量（经 OpenCode Go；成本视模型而定）
LOCOMO_API_KEY=... bun scripts/eval/locomo/run.ts
```

## 环境变量

| 变量                                | 含义                                                         |
| ----------------------------------- | ------------------------------------------------------------ |
| `LOCOMO_API_KEY` / `OPENAI_API_KEY` | 非 dry-run 时 LLM Key（默认当作 **OpenCode Go** Key）        |
| `LOCOMO_BASE_URL`                   | 默认 `https://opencode.ai/zen/go/v1`（`opencode_go` preset） |
| `LOCOMO_MODEL`                      | 默认 `deepseek-v4-flash`（经 Go 网关；可用 `--model` 覆盖）  |
| `LOCOMO_PG_URL`                     | 默认 `postgres://locomo:locomo@127.0.0.1:55432/locomo`       |
| `LOCOMO_REDIS_URL`                  | 默认 `redis://127.0.0.1:56379/0`                             |

数据缓存：`.cache/locomo/`（gitignore）。临时输出：`scripts/eval/locomo/out/`（gitignore）。
已归档样例报告：`scripts/eval/locomo/reports/`（可入库）。

## 指标

| 指标         | 公式                                       |
| ------------ | ------------------------------------------ |
| Token 节省率 | `1 - (FreeAnima / baseline)`（按 QA 均值） |
| 质量保持率   | `FreeAnima_quality / baseline_quality`     |

类别：1 single-hop / 2 temporal / 3 multi-hop / 4 open-ended / 5 adversarial。

## 不进 CI

勿编入 `tests/tiers`。指标单测：`bun test scripts/eval/locomo/metrics.test.ts`。
