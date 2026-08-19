---
title: 番茄钟
---

# 番茄钟

本机专注计时（Habitat `pomodoro.*` + 本地 active）。

## 进行中指示

| 表面           | 范围                                                               |
| -------------- | ------------------------------------------------------------------ |
| 导航倒计时     | Web / 移动 / 桌面主壳：Rail 与底栏番茄入口显示剩余 `MM:SS`         |
| 桌面迷你窗     | 仅 Tauri desktop：置顶 `pomodoro-float` 小窗（倒计时 + 暂停/继续） |
| Android 小组件 | 主屏小组件 MVP（`set_pomodoro_widget_state`）                      |

离开 `/pomodoro` 后，主壳 `PomodoroShellWatcher` 继续阶段完成与同步。
