---
title: 通讯录
---

# 通讯录（Contact）

Commons 内的**联系人**实体：识别「这是谁」，不是行动者 Subject。

## 概念

| 中文    | 代码                          | 说明                                            |
| ------- | ----------------------------- | ----------------------------------------------- |
| 通讯录  | 模块 `/contacts`、`contact.*` | 产品入口与 ToolSet                              |
| 联系人  | `primary_component=contact`   | 单条实体；`title` = 显示名                      |
| Subject | `user` / `agent`              | 可选 `body.subject_id` 挂接；**不是**通讯录本身 |

## World 与权限

- 实体固定在 **Commons**（`world_config.common`，`commons_world_id`）
- **读**：公开 world，全员可读
- **写**：
  - **user**（主人）：全局对任意 world 满权限（见 `getSubjectWorldAccessLevel`），无需 Commons write grant
  - **agent**：须在 Worlds UI 给 Commons 配 **write grant**

## Body 通道

`emails` / `phones` / `addresses` / `wechats`：每项 `{ value, label?, identity_key }`。

- `identity_key: true`：该 `(通道, 规范化值)` 在 Commons 全部联系人中**全局唯一**
- `addresses`：**禁止** `identity_key`（物理地址不具备唯一前提）
- 非 identity 邮箱可多人共用（共享别名）

## 邮件接入

`email_message` **只**存 `from` / `to` 字符串，**不**存联系人外键。

邮件详情展示时对地址调用 `contact.resolveByAddress` **实时解析**（优先身份键命中）：

- 命中 → `显示名 <email>`（可点进通讯录）
- 未命中 → 原样头字段；可「关联」新建联系人或把邮箱并入已有联系人
- 「解除」= 从该联系人通道里去掉该邮箱（不是改邮件行）

RPC：`contact.attachAddress` / `contact.createFromAddress` / `contact.resolveByAddress`。

## Habitat RPC / 工具

- `contact.list|get|search|create|patch|delete`
- `contact.resolveByAddress|attachAddress|createFromAddress`
- ToolSet `contact`（`contact_list` 等）

## 非目标（本期）

- email-handler Skill 自动分类 / 后台批量回填
- 图谱关系表 / 项目·地点节点
- 跨机外部实体注册目录的**自动发现**（#15348）；联邦授信目录见 [`docs/product/federation.md`](../product/federation.md)，授信可选关联 Contact，**不等于**自动授信

## 与跨实例联邦

- Hub `habitat_trusted_satellites` 为安全授信 SSOT；Contact 仅作展示/可选关联
- Satellite 连接触发 `pending`；Hub `federation.satellite.approve` 可传 `create_contact: true` 建 `animas.kind=external`
- 手动 `federation.satellite.create` 仍可预授信（非主路径）
- `contact.resolveByPublicId` 仍只查本机 Commons，不读授信表
