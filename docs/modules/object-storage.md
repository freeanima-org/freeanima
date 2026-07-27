---
title: Object storage
---

# Object storage（对象存储）

Habitat 内容寻址对象层：大文件 / 不变文件。小文本频繁变更（skills 等）走数据库，不走本模块。

**远端为 SSOT**：必须配置 runtime `object_storage`（S3 兼容）。未配置时，使用上传/下载/HTTP GET 等能力一律报错。本地磁盘只作**可丢弃服务器缓存**。远端客户端为 **Bun 内置 `S3Client`**。

**边界**：cid / S3 key 只存在于 `object_file`（及 ObjectStore 实现内部）。业务与前端只持有 **`object_file` entity id**，经 `object_storage.file.get` 取字节。

## 四层缓存（设计 vs 实现）

设计上分四层；**本仓库只实现 1 / 3 / 4**，第 2 层留给运维前置网关。

| 层                    | 设计意图                                      | 本仓库实现                                                                                                             |
| --------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **1. 服务器缓存**     | Habitat 机本地可丢缓存，重启可清              | **已实现**：`os.tmpdir()/anima/objects/{cid[0:2]}/{cid}`；get 未命中则拉远端再写入                                     |
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
  ├─ (1) /tmp/anima/objects/{cid}  可丢
  └─ S3/OSS  SSOT（无预签名、不暴露桶）
```

**不提供** `blob.get`（按 cid 直取）与 S3 预签名 GET。内容不变时用 **ETag=cid** 做廉价 304 即可。

## Entity / ToolSet / CID

| 概念            | 说明                                           |
| --------------- | ---------------------------------------------- |
| CID             | BLAKE3-128 → 32 hex（仅存 entity body / 内部） |
| S3 key          | `world/{worldId}/b3/{cid}`                     |
| `object_file`   | `{ cid, size, mime_type }` + title             |
| `object_folder` | `{ parent_id?, file_ids[] }` + title           |
| ToolSet         | `object_storage`                               |

## HTTP（Habitat RPC REST，需 Bearer）

| 方法                      | 路径                      | 缓存                                                                          |
| ------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `object_storage.file.get` | `object_storage/file/:id` | `Cache-Control: private, no-cache`；`ETag: "{cid}"`；匹配则 304（先于拉字节） |

`<img>` 不能带 Header：SPA 用 **fetch+Bearer → blob URL**（可叠 Cache API）。

## 配置

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

「测试连接」用写/读/删探测对象（`_freeanima/connection-probe/…`），**不**调 `ListBuckets`。RAM 子账号对该 bucket 具备 `oss:PutObject` / `oss:GetObject` 即可（不必 `ListBuckets`）。

RAM 子账号至少需要该 bucket 上的 `oss:PutObject` / `oss:GetObject`（按需 `DeleteObject` / `ListObjects`）。密钥错误或策略过窄时上传会报 `AccessDenied`。

## Companion

Runtime 段 `companion` 存 **`object_file_id`**（非 cid）。上传走 `createObjectFile`；加载走 `object_storage.file.get`。旧仅磁盘 / 旧 `content_hash` 条目需重新导入。

代码：[`src/features/object-storage/`](../../src/features/object-storage/)。
