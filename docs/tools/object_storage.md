---
title: object_storage ToolSet
---

# ToolSet `object_storage`

见 [`docs/modules/object-storage.md`](../modules/object-storage.md)（持久本地库 / 远端 SSOT、无预签名）。

| Tool                      | 作用                                             |
| ------------------------- | ------------------------------------------------ |
| `object_storage_upload`   | 本地 path → put SSOT + 建 `object_file`          |
| `object_storage_download` | 按 id 下载到本地 path                            |
| `object_storage_list`     | 列 world 内 object_file                          |
| `object_storage_delete`   | 软删 entity（blob 保留至满期 purge 时按引用 GC） |
| `object_storage_folder_*` | folder CRUD / `file_ids` 增删                    |

HTTP（Bearer）：仅 `object_storage.file.get`（按 entity id；ETag=cid 协商 304）。空配置时用本机持久库；填齐 S3 则远端为 SSOT。
