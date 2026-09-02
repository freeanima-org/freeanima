---
title: 语音助手（Android）
---

# 语音助手（Android）

Android 移动壳内的唤醒词 + 生活指令闭环：定提醒、加任务、写日记、启动番茄。理解在 TypeScript，写入走 Habitat RPC；番茄钟经客户端导航启动。

## 架构

| 层                             | 职责                                                   |
| ------------------------------ | ------------------------------------------------------ |
| **VoiceWakeForegroundService** | 前台服务持麦；持续 STT 检测唤醒词（默认「小风」）      |
| **portal-sdk/voice-wake**      | Tauri 插件桥：权限、启停、事件                         |
| **portal-sdk/speech-input**    | 双轨 ASR：Android 系统 STT → Hub `asr.transcribe` 兜底 |
| **portal-sdk/voice-assistant** | 状态机、intent 快路径、LLM fallback、TTS 反馈          |
| **portal-sdk/voice-actions**   | 任务/日记 RPC、番茄客户端导航                          |

## 支持指令（快路径）

| 说法示例                   | 动作                                 |
| -------------------------- | ------------------------------------ |
| 「明天早上七点提醒我开会」 | `tasklist.item.create` + `remind_at` |
| 「添加任务买牛奶」         | `tasklist.item.create`               |
| 「写日记：……」             | `diary.create`（当日）               |
| 「开始番茄 / 专注」        | 导航 `/pomodoro?autostart=1`         |

快路径无法解析时，走单回合 LLM（预载 `agenda` + `content` ToolSet）。

## 权限与设置

入口：**设置 → 语音助手**（仅 mobile 壳可见）。

| 项           | 说明                                                        |
| ------------ | ----------------------------------------------------------- |
| 麦克风       | `RECORD_AUDIO`；唤醒与识别必需                              |
| 前台通知     | FGS 常驻；Android 14+ `foregroundServiceType=microphone`    |
| 云端 ASR     | 需 Habitat 配置 `audio_generate.asr`（fun-asr-realtime 等） |
| 仅 Wi‑Fi LLM | 蜂窝网络下复杂指令不走 LLM                                  |

## 限制

- 首期仅 **Android Tauri**；无 iOS / 桌面自定义唤醒词
- 「定闹钟」= 任务/日历提醒，无独立 alarm 实体
- 后台麦克风受系统策略约束，须用户显式开启并接受耗电

## 相关文档

- [media（ASR 子场景）](../tools/media.md)
- [通知与提醒](../aspects/notification-and-reminder.md)
