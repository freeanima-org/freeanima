---
title: Layer structure RFC
---

# 工程八层划分 RFC（v3.1）

> 实现约束：[`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts)、[`.agent/rules/code-layers.md`](../../.agent/rules/code-layers.md)。

## 八层

| 层            | 职责                                                        |
| ------------- | ----------------------------------------------------------- |
| kernel        | Hook / EventBus / Logger / Token                            |
| storage       | schema、repos ports、Config 类型、util、tokenizer、LLM 协议 |
| mechanism     | tool、llm、compress、hooks、skill、session-port             |
| orchestration | session、turn、conversation、loop、runtime 门面             |
| capabilities  | 全部能力包（identity、memory、tools、mcp、acp、estate、…）  |
| connectors    | I/O + port 实现                                             |
| service       | 组合根                                                      |
| entry         | CLI（文档化）                                               |

## 依赖方向

```
entry/service → connectors → capabilities → orchestration → mechanism → storage → kernel
```

- capabilities **包间禁止互依赖**；由 service 组合。
- capabilities **↛ orchestration**。
- orchestration 内部：turn→session，conversation→turn；**禁止** loop→conversation。

## 包 rename（摘要）

| 旧前缀                             | 新前缀                                          |
| ---------------------------------- | ----------------------------------------------- |
| `engine-db` 等 foundation          | `storage-*`                                     |
| `engine-tool` 等 mechanism         | `mechanism-*`                                   |
| `engine-loop` 等 orchestration     | `orchestration-*`                               |
| `@freeanima/orchestration-runtime` | `@freeanima/orchestration-runtime`              |
| `life-self` / `life-memory`        | `capabilities-identity` / `capabilities-memory` |
| `connectors-commands`              | `service-commands`                              |

完整映射见重构 PR / 计划 §4。

## life 解散

- `capabilities/identity`、`capabilities/memory`
- estate：工具面 `capabilities/estate`；I/O `connectors/email`

## 不在本次 scope

- `features.identity/memory` config 开关
- `capabilities-memory` 子包拆分
