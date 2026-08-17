---
title: media（媒体生成）
---

# media（媒体生成）

Habitat 本地 ToolSet：文生图（语音生成见风巢 #135）。

| Tool             | 说明                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `image_generate` | 按 `llm.scenes.image_generate` 调用连接的 `image_protocol`（首批 `openai_images`），结果写入 object_storage |

前置：连接声明 `image_protocol`；场景绑定 connection + model。非默认装载，需 `toolset_load media`。
