---
title: 对象存储
---

# 对象存储

Habitat 内容寻址对象层：大文件 / 不变文件。小文本频繁变更（skills
等）走数据库，不走本模块。Skills：[`skills.md`](skills.md)。

**权威字节（SSOT）**：

| 配置            | SSOT                                                                 | 可丢缓存                                     |
| --------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| 未配 S3（空段） | `FREEANIMA_HOME/object-store/world/{worldId}/b3/{cid}`（持久本地库） | 无                                           |
| 已配 S3 兼容    | 远端桶（Bun `S3Client`）                                             | `os.tmpdir()/anima/objects/{cid[0:2]}/{cid}` |

持久本地库与远端拉通缓存**目录与概念分离**。业务与前端只持有 **`object_file` entity id**，经
`object_storage.file.get` 取字节。cid / S3 key 只存在于 `object_file`（及 ObjectStore
内部）。

## 四层缓存（设计 vs 实现）

设计上分四层；**本仓库只实现 1 / 3 / 4**，第 2 层留给运维前置网关。远端模式下第 1 层为可丢缓存；本地模式下权威字节在持久库，不走
`/tmp`。

| 层                    | 设计意图                                      | 本仓库实现                                                                                                             |
| --------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **1. 服务器缓存**     | Habitat 机本地可丢缓存，重启可清              | **远端模式**：`os.tmpdir()/anima/objects/…`；get 未命中则拉远端再写入。**本地模式**：不用此层                          |
| **2. 网关缓存**       | Caddy / Nginx 等对私有 URL 短缓存             | **设计位**：可对 `object_storage/file/:id` 做私有缓存；须尊重 `Authorization`                                          |
| **3. 浏览器缓存**     | `ETag`=cid 协商 304 + SPA Cache API + `blob:` | **已实现**：`If-None-Match` 命中则 **304 且不拉 S3/tmp**；SPA：`file.get` → Cache API（按 file id）→ `createObjectURL` |
| **4. 客户端本地缓存** | 桌面主动落盘                                  | **已有 Companion**：`companion.sync.pull`                                                                              |

```text
Browser / Desktop
  ├─ (3) Cache API / HTTP ETag(cid) 304 + blob: URL
  └─ (4) 桌面目录（Companion）
        │  Bearer → object_storage.file.get(id)
        ▼
Gateway (2) 可选
        ▼
Habitat
  ├─ entity object_file（对外只暴露 id）
  ├─ 未配 S3：FREEANIMA_HOME/object-store/…  持久 SSOT
  └─ 已配 S3：S3/OSS SSOT + /tmp/anima/objects 可丢缓存
```

**不提供** `blob.get`（按 cid 直取）与 S3 预签名 GET。内容不变时用 **ETag=cid** 做廉价 304 即可。

## 实体 / ToolSet / CID

| 概念            | 说明                                            |
| --------------- | ----------------------------------------------- |
| CID             | BLAKE3-128 → 32 hex（仅存 entity body / 内部）  |
| 对象 key        | `world/{worldId}/b3/{cid}`（S3 与本地路径镜像） |
| `object_file`   | `{ cid, size, mime_type }` + title              |
| `object_folder` | `{ parent_id?, file_ids[] }` + title            |
| ToolSet         | `object_storage`                                |

## 生命周期 / GC

| 阶段                                                  | 行为                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **软删**（`object_storage_delete` / `entity.delete`） | 只写 `deleted_at`；SSOT 字节 **保留**，便于回收站 restore                                                         |
| **purge**（睡眠 cleanup，软删满 30 天）               | 物理删除 entity 行后，对无其它 `object_file`（含未到期软删）仍引用的 `(world_id, cid)` 调用 `ObjectStore.delete`  |
| **`ObjectStore.delete`**                              | **必须**删除当前 SSOT 真实对象（S3 `DeleteObject` 或删本地 `object-store/…`）；并可清 `/tmp` 缓存。失败须抛错可见 |

内容寻址：相同字节共享同一 cid；**仅当引用计数归零**才删权威对象。

## HTTP（Habitat RPC REST，需 Bearer）

| 方法                      | 路径                      | 缓存                                                                          |
| ------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `object_storage.file.get` | `object_storage/file/:id` | `Cache-Control: private, no-cache`；`ETag: "{cid}"`；匹配则 304（先于拉字节） |

鉴权：默认按 Bearer `subject_id` 对 `object_file.world_id` 做 world ACL（read）。与
Habitat UI **SubjectScope** 对齐：**user subject** 可读本 Habitat 的 **agent 默认私有
world**（直通，无需 grant）；不反向放行 agent→user world。MCP/tool 路径仍走
`resolveToolWorld`，不受此 HTTP 直通影响。

`<img>` 不能带 Header：SPA 用 **fetch+Bearer → blob URL**（可叠 Cache API）。

## 配置

空段或未填齐 S3 字段 → 本机持久库。填齐下列字段 → 远端 SSOT：

```yaml
object_storage:
  # 阿里云可填区域根；Habitat/Bun 会改写为 https://{bucket}.oss-cn-….aliyuncs.com
  endpoint: https://oss-cn-beijing.aliyuncs.com
  region: cn-beijing
  bucket: freeanima
  access_key_id: vault("…", "username")
  secret_access_key: vault("…", "password")
  # 阿里云 OSS 须虚拟托管（默认 false）；MinIO 等常需 true
  force_path_style: false
```

「测试连接」用写/读/删探测对象（`_freeanima/connection-probe/…`），**不**调 `ListBuckets`。RAM
子账号对该 bucket 具备 `oss:PutObject` / `oss:GetObject` 即可（不必 `ListBuckets`）。

RAM 子账号至少需要该 bucket 上的 `oss:PutObject` / `oss:GetObject`（按需 `DeleteObject` /
`ListObjects`）。密钥错误或策略过窄时上传会报 `AccessDenied`。

## 桌面伴侣

Runtime 段 `companion` 存 **`object_file_id`**（非 cid）。上传走
`createObjectFile`；加载走 `object_storage.file.get`。旧仅磁盘 / 旧 `content_hash`
条目需重新导入。未配 S3 时字节落本机持久库。

代码：[`src/features/object-storage/`](../../src/features/object-storage/)。
