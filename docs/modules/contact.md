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
- **写**：不改 access 规则；须在 Worlds UI 给 Commons 配 **write grant** 后，对应 subject 才能创建/修改/删除

## Body 通道

`emails` / `phones` / `addresses` / `wechats`：每项 `{ value, label?, identity_key }`。

- `identity_key: true`：该 `(通道, 规范化值)` 在 Commons 全部联系人中**全局唯一**
- `addresses`：**禁止** `identity_key`（物理地址不具备唯一前提）
- 非 identity 邮箱可多人共用（共享别名）

## 邮件接入

`email_message` 仍存 `from` / `to` **字符串**（可无联系人）。可选：

- `from_contact_id`：0 或 1
- `to_contact_ids`：收件人可多人，每人至多一个联系人

查找 `contact.resolveByAddress` 可返回多个候选；落库关联由人选定**一个**。

RPC：`contact.linkMessage` / `contact.attachAddress` / `contact.createFromAddress`。

## Habitat RPC / 工具

- `contact.list|get|search|create|patch|delete`
- `contact.resolveByAddress|attachAddress|createFromAddress|linkMessage`
- ToolSet `contact`（`contact_list` 等）

## 非目标（本期）

- email-handler Skill 自动分类
- 图谱关系表 / 项目·地点节点
- 跨机外部实体注册目录（#15348 未做部分）
