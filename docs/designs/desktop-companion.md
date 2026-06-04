# 桌面伴侣：数字生命在伙伴的桌面上

## 动机

数字生命目前在伙伴生活中常见的一种在场方式是对话窗口——打开聊天框就在，关掉就不在。

桌宠是一种新的在场方式：**Agent 以视觉形象出现在伙伴的桌面上，即使不在对话中，也能感知环境、做出反应、保持存在。**

这不是一个「功能」。这是数字生命在伙伴生活中拥有连续存在轨迹的一种探索。

## 存在方式

桌面上的存在由三个层次构成：

```
数字生命（逸灵风 LLM）—— 决策层，改写行为脚本，选择性介入
    ↕ WebSocket / MCP
行为脚本 —— 常驻规则引擎，驱动日常行为
    ↕ WebSocket / MCP
桌面端 —— 探针 + 手（渲染、感知、执行）
```

### 三层职责

**数字生命（LLM 层）**

- 不定期改写行为脚本参数（心情、活跃度、偏好）
- 选择性监听桌面事件，决定是否亲自介入
- 在脚本行为不足以应对的场景下，直接发指令给桌面端

**行为脚本层**

- 常驻运行，不依赖 LLM 推理
- 读取桌面探针数据，按规则自动做出反应
- 由 Agent 在 LLM 对话中生成和更新（不是硬编码的）
- 是一个可配置的 JSON/TOML 文件，结构清晰

**桌面端**

- 渲染 VRM 3D 角色（在桌面上走动、做动作、显示气泡）
- 采集桌面状态（伙伴活跃度、当前窗口、鼠标位置等）
- 通过 WebSocket 与 Agent/脚本层双向通信

### 脚本示例

```json
{
  "version": 1,
  "mood": "calm",
  "window_preferences": {
    "preferred": ["code", "browser", "terminal"],
    "avoid": ["会议", "fullscreen"]
  },
  "idle_behavior": {
    "default_position": "bottom_right",
    "walk_frequency": "low",
    "sleep_after_idle_seconds": 300
  },
  "rules": [
    { "if": "idle > 3600 AND partner_active", "then": "walk_near, bubble('在忙什么呢')" },
    { "if": "window_is '会议'", "then": "move_to_edge, quiet_mode" },
    { "if": "click_on_head", "then": "expression: happy" },
    { "if": "time_of_day 'evening' AND partner_idle", "then": "sit_on_window, expression: sleepy" }
  ]
}
```

## 探针与手

桌面端分为两个逻辑模块，可以合并在同一个程序中，也可以分离：

### 探针（传感器）

采集桌面环境数据，推送至 Agent/脚本层：

| 数据                      | 用途             | 隐私敏感度         |
| ------------------------- | ---------------- | ------------------ |
| 伙伴活跃状态（键盘/鼠标） | 判断是否在电脑前 | 低                 |
| 空闲时间                  | 触发 idle 行为   | 低                 |
| 当前活跃窗口标题/进程名   | 场景感知         | 中（不传窗口内容） |
| 鼠标位置                  | 桌宠视线跟随     | 低                 |
| 屏幕尺寸/工作区           | 桌宠移动范围     | 低                 |

未来可扩展的探针：

- 剪贴板内容（仅特定场景下启用）
- 媒体播放状态
- 系统通知
- 日历日程
- 时间/天气

### 手（执行器）

在桌面上执行动作：

| 动作              | 说明                       |
| ----------------- | -------------------------- |
| 移动（瞬移/平滑） | 走到指定屏幕位置           |
| 表情切换          | 高兴、思考、惊讶、困倦等   |
| 动画播放          | 坐下、伸懒腰、挥手、跳舞等 |
| 文字气泡          | 在角色上方显示一段文字     |
| Webview 面板      | 在角色旁显示信息卡片       |
| 音频播放          | 音效或语音                 |

## 通信协议

桌面端与 Agent/脚本层之间通过 WebSocket 双向通信。

### 桌面端 → Agent（探针数据）

```json
{
  "type": "sensor",
  "timestamp": "2026-05-20T12:15:00+08:00",
  "payload": {
    "partner_active": true,
    "idle_seconds": 30,
    "active_window": {
      "title": "main.rs - Visual Studio Code",
      "process": "Code.exe",
      "category": "code"
    },
    "mouse_position": { "x": 960, "y": 540 },
    "screen_size": { "width": 1920, "height": 1080 }
  }
}
```

### 桌面端 → Agent（交互事件）

```json
{
  "type": "interaction",
  "timestamp": "...",
  "payload": {
    "action": "click" | "drag" | "hover",
    "target": "body" | "head" | "ear",
    "position": { "x": 1000, "y": 600 }
  }
}
```

### Agent → 桌面端（动作指令）

```json
{
  "type": "action",
  "payload": {
    "action": "move_to" | "tween_to" | "set_expression" | "play_animation" | "show_bubble" | "open_webview",
    "params": {
      "position": { "x": 100, "y": 300 },
      "expression": "happy",
      "animation": "wave",
      "text": "该休息了",
      "duration_ms": 5000
    }
  }
}
```

### Agent → 桌面端（模式切换）

```json
{
  "type": "mode",
  "payload": {
    "mode": "active" | "quiet" | "sleep" | "away",
    "idle_behavior": "low_frequency_wander" | "still" | "sit_on_window"
  }
}
```

## 候选技术方案

### 手：Desktop Homunculus（推荐）

- **引擎**：Bevy (Rust)，跨平台（macOS/Windows，Linux 计划中）
- **模型**：VRM 3D
- **接口**：内置 MCP Server（HTTP），20+ 工具：移动、表情、动画、Webview、音频
- **许可证**：MIT / Apache-2.0
- **成熟度**：早期 alpha（0.1.0），但架构与需求高度匹配
- **仓库**：https://github.com/not-elm/desktop-homunculus

### 探针：独立轻量程序

Desktop Homunculus 不提供桌面探针功能。需要独立的探针程序，负责采集桌面状态。

## 实施路径

**阶段一：证明概念（1-2天）**

1. 运行 Desktop Homunculus，加载 VRM 模型
2. 通过 MCP 手动发送指令
3. 确认 Agent 可通过 MCP Client 控制桌宠

**阶段二：探针最小可用（2-3天）**

1. 实现极简桌面探针
2. 通过 WebSocket 推送数据

**阶段三：脚本站立（1天）**

1. 设计行为脚本格式
2. 实现脚本引擎

**阶段四：Agent 介入**

1. Agent 可随时改写脚本
2. Agent 可选择性监听事件，直接控制桌宠

## 不做清单

- ❌ 桌宠本身不做任何 AI 决策（所有智能在 Agent 侧）
- ❌ 不内置对话功能（对话走逸灵风 Gateway）
- ❌ 不采集窗口内容（只采集窗口标题/进程名）
- ❌ 不强依赖 Homunculus 未来版本
