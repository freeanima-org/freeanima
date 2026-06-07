# Recall 统一检索与加载流程

> **v1 ✅ 已实现**：`recall(query)` 搜索 PG `semantic_memory` + `messages` 全文，返回 content 片段（[`life/memory/src/register-tools.ts`](../../life/memory/src/register-tools.ts)）。
> **v2 🚧 规划中**：统一发现入口——跨记忆层与资源层，精简索引 + 下游加载链。

## v1 已实现

| 能力            | 说明                                                        |
| --------------- | ----------------------------------------------------------- |
| `recall(query)` | PG FTS 双源：semantic_memory（默认 5）+ messages（默认 10） |
| `remember`      | semantic_memory CRUD                                        |
| 常驻记忆        | system prompt 注入（非 recall）                             |

## v2 核心原则（🚧 规划中）

- **`recall` 只做检索，不做加载。** 返回精简的索引（标题+描述+类型+标识），不返回完整内容。
- **检索范围：记忆层 + 资源层。** 自我层始终注入系统提示词，不在 recall 范围内。
- **加载由下游工具负责。** recall 告诉 LLM"有什么"，LLM 决定"要什么"，然后调对应的加载工具。

## 检索范围（v2 🚧）

```
recall 统一检索
├── 记忆层（Memory Layer）
│   ├── 语义记忆 — semantic_memory（world/experience/opinion/…）
│   ├── 情景记忆 — messages（对话 FTS）；limbic 🟡 未实现
│   ├── 程序记忆 — skills / procedural facts
│   └── 感性记忆 — imprint 类型；limbic 表 🟡 未实现
│
└── 资源层（Estate Layer）🚧
    ├── 工具（Tools）
    ├── 技能（Skills）
    ├── 内部资产（笔记、项目、代码、文档）
    └── 实体关系（Entity Graph）
```

### 不在检索范围内的

| 内容            | 理由           | 获取方式                                  |
| --------------- | -------------- | ----------------------------------------- |
| 自我层 L1~L4    | 量小，始终需要 | 始终注入 system prompt                    |
| 完整工具 Schema | 只在调用前需要 | `load_tools` 🚧 / 现有 `reload_tools`     |
| 完整记忆详情    | 只在需要时读取 | `read_memory` 🚧 / 现有 `remember` 读单条 |
| 文件完整内容    | 只在需要时读取 | `read_file` ✅                            |
| 实体关系网络    | 只在需要时遍历 | `graph_query` 🚧                          |

## 预设（Preset）（🚧 规划中）

`recall` 通过 `preset` 参数控制不同搜索方向。预设本质上是**对不同记忆/资源类型的结果加权模板**。

### 预设定义

| 预设               | 语义 | 情景 | 感性 | 程序 | 技能 | 工具 | 说明                       |
| ------------------ | ---- | ---- | ---- | ---- | ---- | ---- | -------------------------- |
| `balanced`（默认） | 中   | 中   | 低   | 中   | 中   | 低   | 通用，无特定倾向           |
| `回忆`（recall）   | 高   | 高   | 高   | 低   | 低   | -    | 回想过去、找回情感         |
| `干活`（work）     | 低   | -    | -    | 高   | 高   | 高   | 完成任务、解决问题         |
| `调试`（debug）    | 中   | 中   | -    | 高   | 高   | 高   | 排查问题，需要技术和上下文 |
| `学习`（learn）    | 高   | 低   | -    | 高   | 中   | 低   | 理解一个概念或领域         |

### 扩展性

预设是模板，不是固定分类。后续可添加新预设（如 `社交`、`创作`）。未指定 preset 时默认 `balanced`。

### 用法示例

```
recall("怎么查数据库", preset="干活")
→ 程序记忆 +++
→ 技能      +++
→ 工具      +++
→ 语义记忆  +
→ 情景记忆  -（几乎没有）
→ 感性记忆  --（几乎不需要）

recall("上次我们聊的那个数据库问题", preset="回忆")
→ 情景记忆 +++
→ 感性记忆 +++
→ 语义记忆 ++
→ 程序记忆 +
→ 技能     -
→ 工具     --（几乎不需要）
```

## 完整流程（v2 🚧 规划中）

```
伙伴提问 / LLM 需要信息
        │
        ▼
① recall(query, preset="...")
   └── 统一检索记忆层 + 资源层
   └── 返回精简结果列表（标题+描述+类型+标识）
        │
        ▼  LLM 判断需要什么、怎么用
        │
② 根据结果类型选择下游加载工具:

   ┌──────────────┬──────────────────────────┐
   │ 发现结果类型   │ 下游加载工具              │
   ├──────────────┼──────────────────────────┤
   │ 工具         │ load_tools(["name"])     │ → 完整 Schema
   │ 技能         │ load_skill("name")       │ → 可注入的技能
   │ 语义/感性记忆 │ read_memory("semantic_memory_id")   │ → 完整事实内容
   │ 情景记忆片段  │ scroll_session("id")     │ → 最近的对话上下文
   │ 文件/文档    │ read_file("path")        │ → 文件内容
   │ 实体关系     │ graph_query("entity")    │ → 关联网络
   └──────────────┴──────────────────────────┘
        │
        ▼
③ LLM 根据加载的内容做出响应或进一步决策
```

### 示例

```
你：帮我在服务器上查一下 Nginx 日志最近有没有报错

① 我 → recall("nginx 日志 服务器报错", preset="干活")
    返回：
    - 工具: tail_logs - 查看文件末尾行
    - 工具: grep_logs - 在日志中搜索关键词
    - 事实: Nginx 日志位于 /var/log/nginx/access.log
    - 技能: 排查 Nginx 错误的标准化流程

② 我判断需要工具 → load_tools(["tail_logs", "grep_logs"])
    返回完整 Schema：
    tail_logs(path, lines)
    grep_logs(path, pattern)

③ 我调 tail_logs(path="/var/log/nginx/access.log", lines=50)
    调 grep_logs(path="/var/log/nginx/error.log", pattern="5xx")
```

## 与自我层的关系

自我层（L1~L4）不通过 `recall` 检索。

| 层     | 注入方式               | 理由                                   |
| ------ | ---------------------- | -------------------------------------- |
| 自我层 | 始终注入 system prompt | 量小、固定、每次对话都需要定义"我是谁" |
| 记忆层 | `recall` + 下游加载    | 量大、动态、按需搜索                   |
| 资源层 | `recall` + 下游加载    | 工具定义是临时需要的，调之前才加载     |

## 命名说明

`recall` 的命名保持不改变。

认知心理学中，Recall 正是"主动从记忆中拉取已有信息"的标准术语——不需要外部线索，不需要提示，自己"想起来"。这不是探索未知（discover/find），而是回想自己已经存储的东西。即使检索范围从记忆层扩展到资源层，动作的本质没变。

## 设计演进

```
v1（✅ 当前）: recall 搜 semantic_memory + messages FTS，返回完整片段
v2（🚧 规划）: recall 统一搜索记忆层 + 资源层
            └── 引入 preset 预设
            └── 引入下游加载链（load_tools / read_memory 等）
v3（未来）: 待定
```

## 未解决问题

1. preset 的数量多少合适？3~5 个预设是否覆盖大部分场景，还是需要更多？
2. `recall` 返回的"精简结果"格式——应当是结构化 JSON（方便 LLM 程序化处理），还是自然语言描述（方便 LLM 直接理解）？
3. 下游加载工具的权限控制——`load_tools` 是否应该受场景感知/能力面罩的约束？
