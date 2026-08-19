---
title: Habitat 身份
---

# Habitat 身份

实例与主体的稳定公开标识、密钥材料，以及跨机引用约定。

## Habitat 实例 id

- 形态：`fa_inst_` + [nanoid](https://github.com/ai/nanoid) 字母数字段（`A–Za–z0–9`，无 `_`/`-`）
- 首次启动写入 `habitat_runtime_config.identity`，之后只读
- 以该字符串为 HKDF salt 派生 **Ed25519** 密钥对并持久化（`public_key` / `private_key`，base64url）
- 私钥仅栖息地进程侧；不得进 LLM 上下文或默认壳明文回显

## 主体 public_id 与密钥

- 每个 `user` / `agent` subject body：`public_id`（nanoid）、`public_key`
- 私钥存 `identity.subject_keys[public_id]`，**不进** entity body
- 派生 salt：`` `${habitat_instance_id}:${public_id}` ``

## 阶段约束：单 user

现阶段 `type=user` **全局至多一个**。创建第二个 user 或 boot 发现多个 user 行 → 硬失败。多主体仅开放 `type=agent`。

## 跨机引用（扩展 anima:）

```text
anima:{entities.id}?habitat_instance_id=fa_inst_…
```

- 本机可省略 `habitat_instance_id`
- PG / RPC 外键仍用数字 `entities.id`；URI 不存库当 FK
- **不**另立 `fa://` 协议
- 异机 `habitat_instance_id`：仅解析保留；远程打开另议

见 [`anima-uri.md`](anima-uri.md)。

## 新随机 id 默认 nanoid

新生成的临时/资源 id（消息行 id、offline `client_op_id`、stream id 等）走 `randomPublicId()`（nanoid `customAlphabet`，仅 `A–Za–z0–9`）。**不改写**已落库的旧 uuid 字符串；`randomUuid()` 仅保留给仍需 RFC uuid 形的例外。

## 查看入口

栖息地运维 UI → **资源 → 主体**（`/subjects`）：

- 页顶卡片：`habitat_instance_id` + Habitat 公钥（可复制）
- 列表 / 编辑浮层：主体实体 id、`public_id`、公钥；编辑浮层另给跨机引用 `anima:{id}?habitat_instance_id=…`
- **私钥不下发**；配置 API 对 `identity` 段只返回公开字段
