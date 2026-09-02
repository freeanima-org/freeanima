---
title: media（媒体生成）
---

# media（媒体生成）

Habitat 本地 ToolSet：文生图与文生声。视频生成可在设置里配置，**本轮不接入**本 ToolSet 与引擎。

| Tool             | 说明                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `image_generate` | 按 `image_generate.main` 调用连接的 `image_protocol`，结果写入 object_storage                                                         |
| `voice_generate` | 按 `audio_generate.main` 调用连接的 `audio_protocol`（`edge-tts` / `openai_audio_speech` / `alibaba_audio`），结果写入 object_storage |

前置：连接声明对应模态协议；能力段绑定 connection + model。非默认装载，需 `toolset_load media`。

音频生成（设置「音频生成」）：主场景文生声，子场景 `tts`（朗读 RPC）、`voice_realtime`（实时；产品双工会话后置）。子场景 `asr` 供 **语音助手** Hub 兜底识别（`asr.transcribe`）；不做通用 ASR 产品能力。

音色与合成模型分维：`config.listProviderModels(purpose=voice_generate)` 列合成模型；`config.listProviderVoices` 按 `audio_protocol` 列静态音色。Edge 的场景 `model` 即音色 id；OpenAI / 阿里把音色写在 `*.params.voice`（tool 参数 `voice` 可覆盖）。阿里缺音色会走目录默认（如 `qwen-audio-3.0-tts-plus` → `longanlingxin`），仍无默认则本地报错，避免 CosyVoice 411。
