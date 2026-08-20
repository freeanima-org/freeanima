---
title: 实体模型
---

# 统一实体模型（v0.8）

逸灵风把多数结构化业务数据存入单一 **`entities`** 表。自我层五块亦为 content 实体（`primary_component=self_block`），见 [`self-layer.md`](../cognition/self-layer.md)。

## 层级：subject → world → content

| 层          | 实体类型        | 作用                                    |
| ----------- | --------------- | --------------------------------------- |
| **Subject** | `agent`, `user` | 行动者——存在于 world **之前**且**之外** |
| **World**   | `world`         | 逻辑命名空间 / 权限边界                 |
| **Content** | `content`       | 业务数据（任务、未来记忆组件等）        |

Subject **不**属于某个 world。每个 subject 可有且仅有**一个默认私有 world**（独占，创建 subject 时自动创建）。Content 通过 `world_id` 归属 world，并继承该 world 的可见性边界。

## 两种正交分类

| 层              | 基数               | 用途                                          |
| --------------- | ------------------ | --------------------------------------------- |
| **Entity type** | 4 个固定值         | 架构边界：`content`、`world`、`agent`、`user` |
| **Components**  | 动态，每实体可多个 | 功能标记：`task_list`、`task_item` 等         |

组件字段位于顶层 **`body` JSONB**。**`primary_component`** 记录创建入口 / 模块路由面；当实体已无组件（空壳）时可变为 **null**。列表视图在 primary 存在时仍按 primary 路由。

## `entities` 表

| 列                              | 作用                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `id`                            | `bigint` identity — 全局数字 ID                             |
| `type`                          | 四种实体类型之一                                            |
| `world_id`                      | 原生所属 World（FK → `entities.id`）                        |
| `components`                    | `text[]` 组件标签                                           |
| `primary_component`             | 模块路由主组件（空壳时为 null）                             |
| `title` / `summary` / `content` | 共享文本列（各组件均可使用）                                |
| `body`                          | JSONB 组件载荷                                              |
| `pinned`                        | 实体级置顶（任意 component）                                |
| `reference_count`               | `[[anima:id]]` 引用权重和                                   |
| `tag_ids`                       | 关联 `primary_component=tag` 的 entity id 数组（per-World） |
| `deleted_at`                    | 软删时间戳；null = 存活                                     |
| `created_at` / `updated_at`     | 时间戳                                                      |

**v0.8 引导未含：** 关系表、World 嵌套/挂载、图数据库（PostgreSQL AGE）。Subject↔world 授权在 `world_config.grants`（无单独权限表）。

## 删除语义

三种正交操作（**勿**用「第 N 层」表述；代码与 UI 只用下列名字）：

| 操作                   | 含义                                                                                                                                                                                       | 典型 API                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **remove**（容器移除） | 只改 membership（FK / `tag_ids` / 未来 pool `members[]`）；**不**删组件、不写 `deleted_at`                                                                                                 | `task.move*`、`tag.setOnEntity`、项目 release、未来 `entity.remove`  |
| **deleteComponent**    | 从 entity 去掉某个 component 并清理对应 body 字段；必要时按 `COMPONENT_PRIMARY_PRIORITY` 提升 `primary_component`；删光则空壳（`components=[]`，`primary_component=null`），**不**自动软删 | `entity.deleteComponent` / `deleteEntityComponent`                   |
| **deleteEntity**       | 软删：写 `deleted_at`；默认 list/search 不可见；进 Entity 模块回收站                                                                                                                       | `entity.delete` / 各模块 `*.delete`（语义为软删）                    |
| **restore**            | 清除 `deleted_at`；**不**自动恢复原容器 membership                                                                                                                                         | `entity.restore` / `restoreEntity`                                   |
| **purge**              | 物理 `DELETE`；记忆维护 cleanup 清理 `deleted_at` 满 **30 天** 的行；`object_file` 在无其它实体引用同 `(world_id, cid)` 时同步删除对象存储 blob                                            | `purgeSoftDeletedEntities` + `gcObjectBlobsAfterEntityPurge`（内部） |

## Morph 语义（形态变换）

与上表正交；**勿**用新建行冒充「邮件变任务」：

| 操作        | 含义                                                                                         | 典型 API / 产品入口                                                                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **retype**  | 同 `entities.id`：换 `primary_component` + `components=[to]` + **整表替换** body（非 merge） | `replacePrimaryComponent`；`task.convertToEvent` / `calendar.convertToTask`                                                                                                               |
| **attach**  | 同 id：`components` **追加**组件 + merge 该组件 body；默认 **不改** primary                  | `addEntityComponent`；`entity.addComponent` / `entity_attach_component`；`email.message.attachTask`（邮件上挂 `task_item`）                                                               |
| **detach**  | 去掉附加组件（即 deleteComponent）；载体实体保留；**body 共用键保留**                        | `deleteEntityComponent` → `stripRemovedComponentBodyFields`；`entity.deleteComponent` / `entity_detach_component`；`email.message.detachTask`；或 `task.delete` 在 primary≠`task_item` 时 |
| **promote** | 同 id：仅改 `primary_component` 指向已有 `components` 成员；**不改** components / body       | `promoteEntityComponent`；`entity.setPrimaryComponent` / `entity_promote_component`                                                                                                       |

`entities.body` 为**扁平 merge**（非按组件嵌套）。多组件可声明同一键（如 `note` 与 `diary_entry` 共用 `client_op_id`）。**detach** 仅删除「剩余组件 schema 不再需要」的键，禁止按卸下组件整表清字段。**promote** 零 body 变更；**attach** 时 patch 同键覆盖，调用方应尽量只传新组件字段。

补充规则：

- **容器移除不自动 deleteComponent**（例：从池子 remove 一项，该项上的 `picks_item` 等组件仍保留）。
- **归档 ≠ 回收站**：`task_list.closed`、project `status`、semantic `deprecated` 是产品态，与 `deleted_at` 正交。
- **禁止软删**：`type` ∈ `agent` \| `user` \| `world`；默认 Inbox（`is_default`）清单仍不可删。
- 空壳由主人在 Entity 模块或工具侧决定：补组件、或 `deleteEntity`。
- 壳 **Entity** 模块（[`docs/modules/entity.md`](../modules/entity.md)）：分页列出存活实体（`updated_at` 倒序）+ 回收站。
- **任务 facet**：清单 / complete / 提醒扫描认 `components` **包含** `task_item`（不要求 primary）；primary 仍为 `email_message` 的挂载任务可进 Inbox。对挂载体执行 `task.delete` → **detach**，禁止误删邮件。
- **壳快捷**：应用布局 Rail /「更多」直达入口 = 在实体上 **attach** `shell_quick_entry`（不改 primary；body 仅 `quick_sort_order`）；列举经 `component=shell_quick_entry`；RPC `shell_quick.list|attach|detach`。

## Subject（`agent` / `user`）

- 身份由 **`type`** 加 `agent_config` 或 `user_config` 主组件构成。
- Subject **不**以成员关系意义上的 `world_id` 限定范围；行 `world_id` 保持在引导根（`ENTITY_ROOT_WORLD_ID`）作为表占位。
- **`agent_config` / `user_config` body**：`default_private_world_id`——该 subject 唯一的默认私有 world（创建 subject 时自动创建；可从 subject 拥有的私有 world 配置）；`public_id` / `public_key`——稳定公开身份与验签公钥（见 [`habitat-identity.md`](habitat-identity.md)）。
- **阶段约束：** `type=user` 全局至多一个；多数字生命仅增加 `type=agent`。
- **通知**用 subject 实体 id 作 `recipient_id`（**`bigint` FK → `entities.id`**；见 [`notifications.md`](../cognition/notifications.md)）；id 来自启动时 **`ResolvedWorldContext`**（并持久化到 `habitat_runtime_config.worlds`）。
- **Service API Token**（`service_api_tokens` 表）绑定 subject 实体 id；栖息地 REST/SAP/MCP 从 Bearer token 解析调用方身份。见 [`remote-access.md`](../ops/remote-access.md)。
- **行级 subject 列约定：** 一律 **`bigint` + FK → `entities.id`**（勿再用 `text` / `String(id)`）。含：
  - `conversations.agent_subject_id` — 会话绑定的 agent
  - `messages.subject_id` — 发言主体（user → user；assistant/tool → 会话 agent）
  - `auto_llm_runs.subject_id` / `auto_llm_messages.subject_id` — AutoLlm 行动主体
  - `cron_jobs.subject_id` — 定时任务行动主体
  - `search_documents.subject_id`（+ 既有 `world_id`）— 检索旁表归属；entity 从 world owner 派生，message 从 `messages.subject_id` + 主体默认私有 world
  - `conversation_read_state.subject_id` — 用户已读水位
- **自我层：** `primary_component=self_block`，正文在 `content`，`body.block_key` 区分五块；落在 **agent 默认私有 world**（多数字生命多份自我层另议）。
- Content 实体**不**另加 `subject_id` 列；归属经 `world_id` → `world_config.owner_subject_id`。

### 启动时 ensure（`worlds` 配置）

栖息地启动运行一次 **`ensureWorldSubjects()`**（迁移之后、engine 之前）：

- **可选覆盖**：若设置了 `habitat_runtime_config.worlds.user_subject_id` / `agent_subject_id`（或遗留 `notifications`），确保这些实体 id 存在且 `type` 正确。
- **未配置**：发现最低 id 的 `type=user` / `type=agent` 实体；若无则用下一个序列 id 创建（非固定 `1`/`2`）。
- 确保每个 subject 有**默认私有 world**（`default_private_world_id`）；私有 world id **不固定**。
- 若解析 id 与配置不同（含未设置），**写回** `habitat_runtime_config.worlds`，使下次启动稳定。
- 在内存绑定 **`ResolvedWorldContext`**：`user_subject_id`、`agent_subject_id`、`user_world_id`、`agent_world_id`。
- 类型冲突（配置 id 存在但 `type` 错误）**中止服务启动**。

遗留 SQL 引导种子（公开 world id=1、Inbox id=2）已由迁移移除；默认数据由**代码拥有**，非迁移播种。

## World 命名空间

- **`type: world`** 实体是逻辑容器（权限/列表边界）。
- 可见性、所有者与授权在 **`world_config` body**：
  - `private: false` — 公开 world
  - `private: true` + `owner_subject_id` — 由 `agent` 或 `user` 实体拥有的私有 world
  - `default_private: true` — 标记 subject 的**独占**默认私有 world（每个 `owner_subject_id` 至多一个）
  - `grants: [{ subject_id, permission: "read" | "write" }]` — 显式 subject 授权（**write 含 read**；`subject_id` 不得等于 owner）。在栖息地 Worlds UI 配置；源码中永不按 subject 硬编码。
  - `stable_key?: string` — 可选的 World **跨机逻辑身份**（如 `git:github.com/org/foo`、`novel:…`、`manual:…`）。显示名仍在 `entities.title`。设置时须在 `world_config` 行间唯一（部分唯一索引）。编码笔记/任务优先用**公开**项目 World（一项目一个）——见 [`coding.md`](../modules/coding.md)。**永不**把该字段命名为 `repo_key`。
- **访问规则**（MCP / LLM 工具经 `resolveToolWorld`）：

  | World   | 读                    | 写                      |
  | ------- | --------------------- | ----------------------- |
  | public  | 全部 subject          | owner **或** write 授权 |
  | private | owner **或** 任意授权 | owner **或** write 授权 |

- Owner 始终有完整访问，无需授权行。跨 world 工具调用必须用授权——开源构建不得按 subject id 特判。
- **LLM 工具：** `subject_kind: user|agent` 解析到该 subject 的默认私有 world，再走与显式 `world_id` **相同**的 `assertSubjectCanAccessWorld` 路径（无旁路）。壳 SAP/REST `subject_kind` 仍是 UI 作用域选择（已认证人类切换 user/agent world），不是这条 LLM 授权路径。
- 勿与语义记忆 **`type=world`**（[`memory.md`](../cognition/memory.md) 中的事实分类）混淆——未来迁移后变为 `body.memory_kind=world`。

## 内容

- **`world_id`** 是唯一命名空间键；访问边界继承自所属 world。
- Content 实体不单独存储 owner 列。

### UI 定位：Anima URI

壳 UI 用 **Anima URI**（`anima:{id}?component=…`）定位实体，而非把 URI 字符串存入 PG。FK 字段仍为数字 id（如 `task_item_id`）。省略 `component` 时打开默认本实体的 `primary_component`。见 [`anima-uri.md`](anima-uri.md)——尤其 **分层 vs 持久化**。

## 任务模块（首个消费者）

滴答清单式列表与条目映射为：

| 概念         | 实体           | 组件              |
| ------------ | -------------- | ----------------- |
| 任务域       | `type=world`   | `world_config`    |
| 清单         | `type=content` | `task_list`       |
| 条目（任务） | `type=content` | `task_item`       |
| 发生次       | `type=content` | `task_occurrence` |

条目经 `body.list_id`（实体 id）引用清单。任务条目把 **title** 与 **content** 存在实体列；**标签**用顶层 `tag_ids`（指向同 World 的 `tag` entity，见下节）。**禁止** `body.tags` 字符串数组（存量已迁移剥离）。每个 world 在首次使用任务时**懒创建**一个**默认清单**（`is_default: true`，名称如「收件箱」）（`ensureDefaultTaskListForWorld`）；不可删除或归档，但可重命名。清单 **`body.closed: true`** 表示已归档：默认从主侧栏隐藏（`tasklist.list` 除非 `include_closed`），经 `tasklist.patch({ closed: false })` 恢复；所含任务条目保留。

**重复任务**（`task_item.body.recurrence` + `task_occurrence` 完成历史）、**一层子任务**（`body.parent_id`）、**时段**（`start_at` / `due_at`）、**多提醒**（`reminders[]` / 兼容 `remind_at`）见 [`docs/modules/task.md`](../modules/task.md)。滴答 CSV 一次性导入入口在栖息地数据维护。

任务/清单 **LLM 工具**默认在 **agent subject 专属 private world** 操作，多数调用可省略 `world_id`；按 `id` / `list_id` 操作时从实体反查 world 并校验 caller 权限。**MCP** 工具默认 scope 为 token 绑定 subject 的 private world。壳 SAP/REST 仍通过 `subject_kind` 选择 user/agent world（见下表）。

**文件夹**（`body.is_folder: true`）仅为侧栏树的容器节点——不能直接容纳任务（`tasklist.item.create` / `task.moveToList` 拒绝指向文件夹的 `list_id`）。子清单与子文件夹经 `body.parent_id`（文件夹实体 id，或根处省略/null）引用父文件夹。嵌套不得成环。**文件夹不可归档**——只能删除。删除文件夹递归移除全部子文件夹，并把每个所含清单移到根（`parent_id: null`）；清单任务条目保留。清单 **`body.closed: true`** 表示已归档（仅清单）：默认从主侧栏隐藏（`tasklist.list` 除非 `include_closed`），仅可经 `tasklist.patch({ closed: false })` 恢复；**对已归档清单或其任务的任何其它变更**（重命名、移动、编辑、完成、…）返回 `清单已归档`。删除非文件夹清单时，若 `cascade` 为 true（默认）则软删其任务条目。`sort_order` 在共享同一 `parent_id` 的同级间作用域。

LLM ToolSets：`@freeanima/feature-task/domain` — `task`（条目 CRUD + `task_search`）与 `tasklist`（清单 CRUD + `tasklist_search`）；经 `toolset_load` 加载。省略 `list_id` 时 `task_search` 搜索全部清单。遗留 `tasks` 表与 `/api/tasks/*` 在一次性迁移后移除（[`scripts/archive/migrate-tasks-to-entities.ts`](../../scripts/archive/migrate-tasks-to-entities.ts)）。

### 壳 UI：全局 Subject 作用域

栖息地启动绑定 **`ResolvedWorldContext`**（`createTypedHabitatClient().call("worlds.context")` / `GET /rpc/v1/worlds/context`）。产品壳在模块头暴露**单一 User / Agent 切换**——不是任意 `world_id` 选择器。选择映射到 `user_world_id` / `agent_world_id`，并在该标签页的 `sessionStorage` 持久化。

| 表面             | World 绑定                                  | 控件                       |
| ---------------- | ------------------------------------------- | -------------------------- |
| 壳顶栏           | `user_world_id` 或 `agent_world_id`         | 全局 **User / Agent** 切换 |
| `/tasks`         | 经 SAP `subject_kind` 跟随壳作用域          | 无（继承顶栏）             |
| `/calendar`      | 经 SAP `subject_kind` 跟随壳作用域          | 无（继承顶栏）             |
| `/projects`      | 经 SAP `subject_kind` 跟随壳作用域          | 无（继承顶栏）             |
| `/email`         | 经 SAP `subject_kind` 跟随壳作用域          | 无（继承顶栏）             |
| `/contacts`      | **Commons**（不跟私有 world 切换）          | 无                         |
| `/notifications` | `recipient_kind` + subject 实体 id          | 无（继承顶栏）             |
| `/diary`         | 经 `subject_kind` 的 subject 默认私有 world | 无（继承顶栏）             |
| `/vault`         | 默认 **user** 库；可选 Agent 视图           | User：主密码锁             |

SAP 任务/邮件方法接受可选 `subject_kind`（默认：任务 `user`，邮件 `agent`）。卫星经 `@freeanima/client/portal-sdk` 的 **`useSubjectScope()`** 读壳作用域；栖息地 REST 实体搜索用 **`resolveWorldIdForSubject()`** 与同一作用域。

未来多 world 浏览（如跨 world 的日记日历聚合）应加**模块作用域**过滤或栖息地工具——而非投机的任意 world 选择器。

## 标签模块（轻语义）

标签是独立 content entity，**per-World 扁平池**（无 scope/命名空间、无层级、无全局池）：

| 概念 | 实体           | 组件  |
| ---- | -------------- | ----- |
| 标签 | `type=content` | `tag` |

- **名称**在实体 `title`；body 仅 `sort_order` / `client_op_id`
- 任意 content entity 通过顶层 **`tag_ids`** 挂载标签；含义由「实体类型 + 标签」组合自然产生（不做语义空间区分）
- **禁止** component `body.tags` 字符串数组（vault / email / task / diary 均已收敛到 `tag_ids`）
- 同 World 内 title（trim 后）唯一；删除标签时从该 World 所有实体的 `tag_ids` 剔除
- **栖息地 RPC 行：** 只暴露 `tag_ids`（不暴露字符串 `tags`）
- **LLM/MCP 工具 DX：** 可同时接受 `tags`（标题 find-or-create）与 `tag_ids`；解析后只写 `tag_ids`
- **栖息地 RPC：** `tag.list` / `tag.search` / `tag.suggest` / `tag.create` / `tag.patch` / `tag.delete` / `tag.setOnEntity`
- **LLM ToolSet：** `tag`（`tag_list` / `tag_search` / `tag_create` / `tag_update` / `tag_delete` / `tag_set_on_entity`）
- **搜索：** `EntitySearchOpts.tag_ids`（或 `task_item` filters.`tag_ids`）为数组包含过滤（AND）
- **挂标签 UI：** 共享 `TagPicker`（`features/tag/ui`）— 常用（`tag.suggest` 按目标实体 `primary_component` 频次）+ 搜索（`tag.search`）+ 新建；日记条目 / 日记块 / 任务详情 / Vault 条目共用
- **列表筛选 UI：** 任务/项目等本地 FilterBar（从当前列表收集已有 tag chips），**不是**挂标签交互，不接入 `TagPicker`、不暴露新建
- **兼容：** `diary.suggestTags` 仍可用，内部委托同一频次查询（固定 `diary_entry`）

## 项目模块（v1 规格）

项目管理使用与任务清单文件夹**分开的文件夹树**。任务要么属于任务模块（Backlog，`project_id` null），要么恰好属于一个项目——UI 上不同时属于两边。

| 概念       | 实体           | 组件             |
| ---------- | -------------- | ---------------- |
| 项目文件夹 | `type=content` | `project_folder` |
| 项目       | `type=content` | `project`        |

`task_item.body.project_id` 把条目链到项目。可选项目背景说明用实体 `content`（非 `body`）。任务模块智能清单默认只含无 `project_id` 的任务。壳路由 `/projects`；栖息地 RPC `projectfolder.*`、`project.*`、`project.item.*`；跨边界归属用 `task.moveToProject` / `task.moveToList`。

完整规格：[`docs/modules/project.md`](../modules/project.md)。

## 通讯录模块

Commons 内的联系人（识别用，非 Subject）：

| 概念   | 实体           | 组件      |
| ------ | -------------- | --------- |
| 联系人 | `type=content` | `contact` |

- 固定 `world_id = commons_world_id`；**user** 维护免 Commons write grant；**agent** 仍须手动 write grant（不改全局 access 规则）
- Body：`emails` / `phones` / `addresses` / `wechats` 通道数组；`identity_key` 值须实例内该通道全局唯一；`addresses` 禁止 identity_key
- 可选 `subject_id` 挂本机 user/agent；邮件 `from_contact_id` / `to_contact_ids` 可选关联

见 [`docs/modules/contact.md`](../modules/contact.md)。

## 邮件模块（资源层）

邮件账户、线程与镜像消息映射为：

| 概念 | 实体           | 组件            |
| ---- | -------------- | --------------- |
| 账户 | `type=content` | `email_account` |
| 线程 | `type=content` | `email_thread`  |
| 消息 | `type=content` | `email_message` |

账户在 `body.sync.mailboxes` 存储 SMTP/IMAP 设置与**每邮箱同步游标**（遗留单一 `mailbox`/`last_uid` 在读取时迁移）。另有 `mailbox_paths`、`sent_mailbox` / `trash_mailbox` / `drafts_mailbox`、`delete_policy`（默认 `move_to_trash`）。消息在 `body.imap_uid` + `imap_mailbox` 存 IMAP UID；`\Seen`/`\Flagged` 镜像为 `unread` / `flags`（RPC 暴露 `flagged`）。可读主题用实体 `title`。同步流水线：LIST + SPECIAL-USE → 多邮箱增量 UID 拉取 + FLAGS 刷新 → RFC822 → CTE/字符集解码 → 附件剥离到**对象存储**（`createObjectFile` → `body.attachments[].object_file_id`）→ 把**解码后的 content 原文**存实体 `content`（`text/plain` 或 `text/html`，见 `body.content_type`）；纯文本始终在 `body.text`。**不要**在实体上保留完整 RFC822 blob。发送：SMTP（+ 可选 `attachment_object_file_ids`）然后 **APPEND** 到 Sent 并带 `\Seen`（有附件时 MIME 为 multipart）；出站邮件同样写入 `body.attachments`。删除：默认 MOVE 到 Trash；软删消息/账户时也软删关联 `object_file` 实体（字节保留到 purge + GC）。栖息地可在收件箱跑 **IMAP IDLE**（进程内 `Bun.cron` `builtin-email-sync-all` 每 5 分钟跨全部 world 作回退，非 PG `cron_jobs`；自动同步新收件箱邮件标题 → 每个所属 subject world 一条通知，手动同步不发）。搜索是**本地实体混合**（FTS+trgm），对已同步邮件带多过滤器（`mailbox`/`from`/`to`/`subject`/`unread`/`flagged`/`has_attachment`/日期）——不是 IMAP SEARCH。UI `/email` 是常规三栏邮件客户端（真实 IMAP 文件夹）。`email_read` / `email.message.read`：默认正文 = 纯文本；`raw=true` = content 原文。附件字节经 `object_storage.file.get` 用 `object_file_id`；发送上传经 `email.attachment.upload`。

LLM ToolSets：`@freeanima/feature-email/domain` — `email-account`（账户实体）与 `email`（同步、收发、搜索）；经 `toolset_load` 加载。user 与 agent 各在其**默认私有 world** 有账户；LLM 工具接受可选 **`world_id`**（SAP 用 `subject_kind`）。遗留 `config.yaml` `email.accounts[]` 经 [`scripts/archive/migrate-email-to-entities.ts`](../../scripts/archive/migrate-email-to-entities.ts) 迁移。

## 日记模块

**user** 与 **agent** 主体的结构化日记条目：

| 概念 | 实体           | 组件          |
| ---- | -------------- | ------------- |
| 条目 | `type=content` | `diary_entry` |

条目位于各 subject 的 **`default_private_world_id`**。`body.entry_at` 是时间线排序键；可选顶层 **`tag_ids`**（指向同 World 的 `tag` entity；历史 `body.tags` 字符串已迁移剥离）。**正文在子 `content_block` 行**（`block_type: text`，`parent_id` → 条目）；容器实体 `content` 列未用（一次性迁移后为空）。

- **SAP：** `diary.*` + `diary.block*` — 均接受 `subject_kind: user | agent`。`diary.append` 新增文本块；`diary.patch` 仅更新元数据；删除级联块。
- **UI：** 壳 `/diary` — 多文本块编辑器，可拖拽重排。
- **LLM：** ToolSet `diary` — 默认调用方 subject 私有 world；可选 `world_id`。块级编辑也可经 ToolSet `content-block`。

见 [`docs/modules/diary.md`](../modules/diary.md)。

## 日历模块

**user** 与 **agent** 主体的统一日程表面：

| 概念 | 实体           | 组件             |
| ---- | -------------- | ---------------- |
| 事件 | `type=content` | `calendar_event` |

事件位于各 subject 的默认私有 world。Body：`start_at`（必填）、`end_at`、`all_day`、`remind_at` / `last_notified_at`（可调度）、`client_op_id`。标题/备注在实体列。

- **SAP：** `calendar.list` / `create` / `get` / `patch` / `delete` + `calendar.range`（聚合 event + task due + project 区间）
- **UI：** 壳 `/calendar` — 日/近三天/近七天议程 + 周/月网格
- **LLM：** ToolSet `calendar`

见 [`docs/modules/calendar.md`](../modules/calendar.md)。

## Content block（内容块）

供**容器**（日记、笔记、…）复用的内容砖。`block_type` 仅技术分类；语义经 `components[]` 标签挂载（不是嵌套 JSONB `components` 列——标签仍为 `text[]`，字段扁平合并进 `body`）。

| 概念 | 实体           | 组件            |
| ---- | -------------- | --------------- |
| 块   | `type=content` | `content_block` |

| Body / 列         | 作用                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `body.block_type` | `text` \| `image` \| `audio` \| `video` \| `link_card` \| `file` |
| `body.parent_id`  | 容器实体 id（`diary_entry` \| `note`）                           |
| `body.sort_order` | 视图顺序；块无语义优先级                                         |
| `body.url`        | 非文本类型的资源定位；文本为 null                                |
| `content` 列      | 文本正文或媒体说明                                               |

同行可选语义组件（`components[]`；字段扁平合并进 `body`）：

| 组件              | `body` 字段                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `limbic`          | `valence`、`arousal`、`intensity`，可选 provenance（`kind`、`legacy_id`、…）                    |
| `narrative`       | `significance`，可选 `period_*` / `status` / `legacy_id`                                        |
| `dream`           | `source_limbic_ids`、`source_conversation_ids`、`episodic_snippets`、`legacy_id`                |
| `semantic_ref`    | `entity_id`（指向 `primary_component=semantic_memory` 的 entity）                               |
| `semantic_memory` | `memory_kind`、`status`、`source_conversations`、`observed_at`、`occurred_at`，可选 `legacy_id` |

**容器终态：** `diary_entry` 与 `note` 均为 content-block 容器。梦境 / 感性 / 自传记忆是带匹配语义标签的 `content_block` 行，挂在该 CST 日的日记下（记忆维护写入用 agent 默认私有 world）。

- **LLM：** ToolSet `content-block`（`@freeanima/features/content-block/domain`）— `content_block_create` / `update` / `delete` / `get` / `list` / `search` / `reorder`。`list` 需要容器 `parent_id`；可选 `component=limbic|narrative|semantic_ref|dream` 过滤语义标签；`reorder` 批量更新 `sort_order`。可选 `world_id`；`parent_id` / 块 `id` 可推断 world。
- **搜索过滤：** `parent_id`、`block_type`、`client_op_id`（`entity_search` / store 共享白名单）。

## 笔记本模块

**user** 与 **agent** 主体的主题向笔记：

| 概念 | 实体           | 组件   |
| ---- | -------------- | ------ |
| 笔记 | `type=content` | `note` |

笔记位于各 subject 的 **`default_private_world_id`**。组织维度是 **标题 / 标签 / 搜索**（无按日唯一键）。可选顶层 **`tag_ids`**。**正文在子 `content_block` 行**（`block_type: text`，`parent_id` → 笔记）；容器实体 `content` 列空置。

同一实体可同时挂 `diary_entry` 与 `note`（attach）；模块列表按 **`primary_component`** 归属（笔记本列表仅 `primary_component=note`）。

- **SAP：** `note.*` + `note.block*` — 均接受 `subject_kind: user | agent`。
- **UI：** 壳 `/note` — 列表 + Markdown 源码编辑与预览；跨笔记引用用 `[[anima:id]]`。
- **LLM：** ToolSet `note` — 按实体 id；可选 `world_id`。块级编辑亦可经 ToolSet `content-block`。

见 [`docs/modules/note.md`](../modules/note.md)。

## 梦境（记忆维护流水线）

夜间创意叙事（仅追加，每个日记日至多一个梦境块）：

| 概念 | 实体           | 组件                      |
| ---- | -------------- | ------------------------- |
| 梦境 | `type=content` | `content_block` + `dream` |

写入 **agent** subject 的 **`default_private_world_id`**：确保当日 `diary_entry`，再插入带 `dream` 标签的文本 `content_block`。日历日来自父日记 `entry_at`（CST），不是 `dream_day` body 字段。

- **读：** `diary_get` / `content_block_list` / `content_block_search` 带 `component=dream`。
- **UI：** 壳 `/diary` 以只读「梦境」标签显示梦境块（无独立 `/dream` 模块）。
- **LLM：** 无专用 `dream` ToolSet；dream 写入路径已拆除（存量只读）。

见 [`docs/cognition/dream.md`](../cognition/dream.md)。

## Vault 模块（资源层）

两个库中的加密凭证（**User** + **Agent**），ECS 组件 `vault_config` + `vault_item`：

| 概念 | 实体           | 组件         |
| ---- | -------------- | ------------ |
| 条目 | `type=content` | `vault_item` |

| 库    | 加密模式          | 解密位置                                          | 无头注入                                                    |
| ----- | ----------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| User  | `master_password` | 客户端（壳 / 浏览器扩展）                         | 否 — 聊天室解锁、`/vault`、扩展解锁；持有 Agent 根密钥 SSOT |
| Agent | `machine`         | 栖息地（经 `vault.agentKey.*` 从 User SSOT 缓存） | 仅栖息地缓存解锁时 — cron / 工具                            |

隐私字段在 `body.secrets_enc` + `body.dek_wrapped`。明文元数据：title、`url`、可选 `uris[]`（`uri` + `match`）、username、可选 `last_used_at`（ISO；经 `vault.touch` 自动填充 bump，跳过 revision）、顶层 **`tag_ids`**（同 World `tag` 实体；无 `body.tags`）、`custom_field_names`、可选 `import_refs`（如 Bitwarden cipher UUID）。密钥载荷可含 `password` / `totp` / `notes` / `custom_fields` / 结构化 `card` / `identity`。

**修订：** vault 条目参与实体级 `entities.revisions` 白名单（实质性更新最多 10 份快照）。壳 `/vault` 可列历史并恢复；见 [`docs/aspects/entity-revisions.md`](../aspects/entity-revisions.md)。更改主密码须重包当前与历史 `dek_wrapped`。`vault.touch`（仅 `last_used_at`）**必须** `skip_revision`。

- **SAP：** `vault.*` — 壳默认 `subject_kind: user`；ToolSet 默认 agent world。历史：`vault.history.list` / `vault.history.restore`；自动填充 bump：`vault.touch`（不暴露给 LLM ToolSet）。
- **UI：** 壳 `/vault`（`@freeanima/features/vault`）；Bitwarden 未加密 JSON 导入（`import_refs.bitwarden` 幂等）；内嵌聊天室有独立主密码解锁。User 库解锁时自动确保 Agent 根密钥 SSOT；栖息地「数据维护」可解锁 Agent 库（SSOT → `vault.agentKey.provision`）。
- **浏览器形态入口：** `packages/frontend/portal/extension`（展示名 FreeAnima）— 直连栖息地 REST；Vault 主密码会话见 [`docs/modules/vault.md`](../modules/vault.md)；安装与 gecko id 见 [`docs/modules/portal.md`](../modules/portal.md)。
- **LLM：** ToolSet `vault` — 仅栖息地（非 MCP）：元数据 list/search/get；`vault_create` / `vault_update` / `vault_delete`（create/update 密封到 Agent 库）；凭证经 `terminal_run` / `code_execute` `secrets[]`（仅子进程 env）或 `browser_type` `secret`（键入页面；工具结果打码）；工具结果或栖息地 `process.env` 永不明文密钥。
- **配置：** 运行时 PG 设置可用 `vault("item_id", "field")`（Agent 库）或 `env("KEY")`（遗留 `credential()` 已移除）。引导 `config.yaml` 无法解析 `vault()` — PostgreSQL 起来前用 `env()` 或明文。

遗留 pass（`~/.password-store`）**不会从磁盘删除**；请经壳 UI 手动迁移条目。

## Subagent 配置

具名 AutoLlm subagent 配置：`type=content`，`primary_component=subagent`。Body 字段含 `slug`、`skills`、`max_loop_iterations`、`allowed_tools`、`denied_tools`。见 [`subagent.md`](../modules/subagent.md)。

## 查询

实体 **list**（确定性浏览）与 **search**（相关性排序）是独立端口：

| 端口                      | 作用                                             |
| ------------------------- | ------------------------------------------------ |
| `EntityStorePort.list`    | 结构过滤；稳定排序                               |
| `EntitySearchPort.search` | 硬过滤 + 可选文本查询；经 RRF 的混合 FTS/trigram |

**作用域：** 默认 `world_id`；`global: true` 需要显式可访问 world 白名单（`resolveWorldsAccessibleBySubject`：公开 + 自有私有 + grant 可读 world）。

**组件过滤：** 按 `primary_component` 白名单（如 `task_item`：`status`、`list_id`、`tag_ids`、`due_today`）。顶层 `tag_ids` 过滤跨组件适用。禁止任意 JSONPath。

**工具 / API：** `entity_search`（LLM/MCP）与 `createTypedHabitatClient().call("entity.searchGet")` / `createTypedHabitatClient().call("entity.searchPost")`（REST `GET /rpc/v1/entity/searchGet` | `POST /rpc/v1/entity/searchPost`）共享 `EntitySearchPort`。任务 UI 搜索框用同一栖息地 RPC 端点。

FTS 运算符语法见 [`memory.md`](../cognition/memory.md) 记忆混合搜索；实体搜索复用同一查询构建器。

**FTS 索引：** 可重建字段在 `search_documents`（jieba → `fts_segmented` → 生成 `search_fts`；异步 `embedding`）。实体创建/更新经 `SearchBackend.upsert` 索引。遗留行可能缺分词；跑栖息地 **FTS** 重建（`onlyMissing`）回填 `search_documents`。业务转储可排除 `search_documents`（见 [`database.md`](../ops/database.md)）。

## 未来迁移图

| 遗留表                         | 目标                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `dream_memory` / `dream_entry` | `content_block` + `dream`（parent = 按日 `diary_entry`；**已完成**；独立 `/dream` UI / ToolSet 已退役）                    |
| `semantic_memory`              | `primary_component=semantic_memory`（独立 entity；**已完成**）                                                             |
| `autobiographical_memory`      | `content_block` + `narrative`（parent = 按日 `diary_entry`；**已完成**）                                                   |
| `limbic_memory`                | `content_block` + `limbic`（parent = 按日 `diary_entry`；**已完成**）                                                      |
| `diary_entry` 单 body          | 容器 + 子 `content_block`（**已完成**；迁移清空容器 `content`）                                                            |
| 全局时间摘要                   | `primary_component=temporal_summary`（day/month/year；见 [`temporal-summary.md`](../cognition/temporal-summary.md)）       |
| `tasks`（遗留）                | `task_item`（显式迁移时）                                                                                                  |
| `config.yaml email.accounts`   | `email_account`（见 [`scripts/archive/migrate-email-to-entities.ts`](../../scripts/archive/migrate-email-to-entities.ts)） |
| `self_blocks`                  | `primary_component=self_block`（agent 默认私有 world；**已完成**）                                                         |
| `memory_references`            | 关系表（未来）                                                                                                             |

认知层上下文见 [`architecture.md`](architecture.md)。
