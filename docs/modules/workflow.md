---
title: 工作流
---

# 工作流（Workflow）

确定性多步图：**ToolSet 是手；Workflow 是确定性步骤图；技能是自然语言招式；子代理是 LLM 探索委派。**

心智位置：

`Tool / ToolSet → Workflow → Skill → Subagent`

## 生命周期

1. **临时**：`workflow_run({ steps, input })` — 当场构图执行，跑完即弃（可 `debug:true` 看中间步，不落中间态）
2. **命名**：调试通过后 `workflow_save({ name, steps })` 固化为实体；之后 `workflow_run({ name, input })`

## 存储

- **一个 Workflow = 一个实体**（`primary_component = workflow`）
- `title` = name（小写连字符），`summary` = 描述，`content` = 可选人读说明
- `body.steps` / `input_schema` / `output_schema` / `allowed_tools` / `denied_tools` / `origin` / `status` / `pure`
- World：Commons ∪ agent private（与技能同款解析，实现侧按调用方 world）
- **运行记录**：表 `workflow_runs` 只落顶层 `{input, output}`；中间步仅内存

## 步骤类型

| type        | 说明                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `tool`      | 调用已注册 Tool；`args` 值为 ValueRef                                                                            |
| `llm`       | 经 **AutoLlm**（`runKind=workflow_llm`）；`scenario` ∈ chat/summary/reflect/goal_judge/skill_review（默认 chat） |
| `workflow`  | 嵌套具名子 Workflow；父只见子顶层 output                                                                         |
| `transform` | 结构化变换（pick/get/pluck/filter_*/merge/template_object）                                                      |

## ValueRef（类型安全绑定）

禁止 `jp:` / jq 自由字符串。绑定用 Zod 判别联合：

```json
{ "ref": "literal", "value": "weekly" }
{ "ref": "input", "path": ["date"] }
{ "ref": "prev" }
{ "ref": "step", "id": "summary", "path": ["text"] }
{ "ref": "last_run" }
{ "ref": "object", "fields": { "a": { "ref": "input", "path": ["x"] } } }
```

| 魔法变量（文档）        | ValueRef                             |
| ----------------------- | ------------------------------------ |
| `$input` / `$input.k`   | `ref:input` + path                   |
| `$prev`                 | `ref:prev`                           |
| `$step.<id>.output`     | `ref:step` + id                      |
| `$last_run` / `.output` | `ref:last_run`（仅顶层具名成功 run） |

## 保存时静态校验

`workflow_save` / `workflow_update` / 临时 `workflow_run(steps)` 会跑 `validateWorkflowDefinition`：

1. **L1**：step id 唯一；step 引用必须前向；scenario / 子 Workflow 名合法
2. **L2**：`input_schema` 与 `ref:input` 路径对齐
3. **L3**：上下游有 schema 时检查 tool 参数连线（缺 `returnSchema` 默认 warning；`strict_schema:true` 升 error）

## LLM 节点与 AutoLlm

- **一律** `runAutoLlm`（非裸 chat）
- 默认无工具；步可声明 `allowed_tools`，与 Workflow / 调用方策略取更紧
- AutoLlm 审计进 `auto_llm_runs`；Workflow 顶层仍只写 `workflow_runs`

## 嵌套隔离

- 父见 `$step.<child_id>.output` = 子顶层 output
- 父看不到子中间步；调试子 Workflow 需单独 run
- 嵌套调用**不**更新子的 `$last_run`

## ToolSet `workflow`

| 工具                                                    | 作用                                    |
| ------------------------------------------------------- | --------------------------------------- |
| `workflow_run`                                          | `name` XOR `steps` + `input` + `debug?` |
| `workflow_save` / `workflow_update` / `workflow_delete` | CRUD                                    |
| `workflow_list` / `workflow_get`                        | 目录与详情                              |

默认对话 ToolSet 含 `workflow`（与 `skill` / `subagent` 同级）。

## 与邻近概念

| 勿混淆          | 原因                       |
| --------------- | -------------------------- |
| Skill           | LLM 解释的招式，非确定性图 |
| Subagent        | `named\|ephemeral` LLM 环  |
| engine Pipeline | 宿主运维 DAG（记忆维护等） |
| Goal            | 对话内续写                 |

## 分期未做

- Habitat UI 管理页
- pure 自动并行与结果缓存
- 通用 ToolDef 级 `pure` 标记
