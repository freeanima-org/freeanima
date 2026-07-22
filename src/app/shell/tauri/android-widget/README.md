# 番茄钟主屏小组件 MVP（Android Glance 占位）

数据流：

1. shell-ui / pomodoro 调用 `invoke("set_pomodoro_widget_state", …)`
2. Rust MobileState 持有快照；后续写入 SharedPreferences 键 `freeanima.pomodoro.widget`（与 shell-sdk pomodoro-active 语义对齐）
3. Receiver + GlanceAppWidget 读键并 `updateAll`

`tauri android init` 生成工程后，将实现并入 `app/src/main/java/...`，并在 AndroidManifest 注册：

```xml
<receiver android:name=".widget.PomodoroWidgetReceiver" … />
```

SharedPreferences 键约定：

| 键                             | 含义       |
| ------------------------------ | ---------- |
| `freeanima_shell` / prefs name | 壳偏好文件 |
| `pomodoro.phase`               | 阶段       |
| `pomodoro.remaining_sec`       | 剩余秒     |
| `pomodoro.task_title`          | 任务标题   |

仓库内 `CodeqlKeepalive.java` 仅供 CodeQL java-kotlin 语言扫描保活，无运行时引用。
