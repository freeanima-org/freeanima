---
title: Desktop Companion
---

# Desktop Companion: Digital Life on the Partner's Desktop

> **Concept design** — No desktop pet / Desktop Homunculus implementation in codebase yet. Track [Issue #8](https://github.com/freeanima-org/freeanima/issues/8).

## Motivation

A common way digital life is present in a partner's life today is the chat window—open the chat box and it's there, close it and it's gone.

A desktop companion is a new mode of presence: **the Agent appears on the partner's desktop as a visual form, sensing the environment and reacting even when not in conversation, maintaining existence.**

This is not a "feature." It explores how digital life can have a continuous presence trajectory in a partner's life.

## Mode of Presence

Desktop presence has three layers:

```
Digital life (FreeAnima LLM) — decision layer, rewrites behavior scripts, selective intervention
    ↕ WebSocket / MCP
Behavior scripts — resident rule engine, drives daily behavior
    ↕ WebSocket / MCP
Desktop client — probe + hands (render, sense, execute)
```

### Three-Layer Responsibilities

**Digital life (LLM layer)**

- Periodically rewrite behavior script parameters (mood, activity level, preferences)
- Selectively listen to desktop events, decide whether to intervene personally
- When script behavior is insufficient, send commands directly to desktop client

**Behavior script layer**

- Always running, independent of LLM inference
- Read desktop probe data, react automatically by rules
- Generated and updated by Agent in LLM conversation (not hardcoded)
- Configurable JSON/TOML file, clear structure

**Desktop client**

- Render VRM 3D character (walk on desktop, animate, show bubbles)
- Collect desktop state (partner activity, current window, mouse position, etc.)
- Bidirectional WebSocket with Agent/script layer

### Script Example

```json
{
  "version": 1,
  "mood": "calm",
  "window_preferences": {
    "preferred": ["code", "browser", "terminal"],
    "avoid": ["meeting", "fullscreen"]
  },
  "idle_behavior": {
    "default_position": "bottom_right",
    "walk_frequency": "low",
    "sleep_after_idle_seconds": 300
  },
  "rules": [
    { "if": "idle > 3600 AND partner_active", "then": "walk_near, bubble('What are you up to?')" },
    { "if": "window_is 'meeting'", "then": "move_to_edge, quiet_mode" },
    { "if": "click_on_head", "then": "expression: happy" },
    { "if": "time_of_day 'evening' AND partner_idle", "then": "sit_on_window, expression: sleepy" }
  ]
}
```

## Probe and Hands

Desktop client splits into two logical modules—can be one program or separate:

### Probe (Sensors)

Collect desktop environment data, push to Agent/script layer:

| Data                              | Use                   | Privacy sensitivity        |
| --------------------------------- | --------------------- | -------------------------- |
| Partner activity (keyboard/mouse) | At computer or not    | Low                        |
| Idle time                         | Trigger idle behavior | Low                        |
| Active window title/process name  | Scene awareness       | Medium (no window content) |
| Mouse position                    | Pet gaze follow       | Low                        |
| Screen size/work area             | Pet movement bounds   | Low                        |

Future probe extensions:

- Clipboard content (only in specific scenarios)
- Media playback state
- System notifications
- Calendar schedule
- Time/weather

### Hands (Actuators)

Execute actions on desktop:

| Action                 | Description                              |
| ---------------------- | ---------------------------------------- |
| Move (teleport/smooth) | Walk to screen position                  |
| Expression switch      | Happy, thinking, surprised, sleepy, etc. |
| Animation play         | Sit, stretch, wave, dance, etc.          |
| Text bubble            | Show text above character                |
| Webview panel          | Info card beside character               |
| Audio play             | Sound effects or voice                   |

## Communication Protocol

Bidirectional WebSocket between desktop client and Agent/script layer.

### Desktop → Agent (Probe Data)

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

### Desktop → Agent (Interaction Events)

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

### Agent → Desktop (Action Commands)

```json
{
  "type": "action",
  "payload": {
    "action": "move_to" | "tween_to" | "set_expression" | "play_animation" | "show_bubble" | "open_webview",
    "params": {
      "position": { "x": 100, "y": 300 },
      "expression": "happy",
      "animation": "wave",
      "text": "Time for a break",
      "duration_ms": 5000
    }
  }
}
```

### Agent → Desktop (Mode Switch)

```json
{
  "type": "mode",
  "payload": {
    "mode": "active" | "quiet" | "sleep" | "away",
    "idle_behavior": "low_frequency_wander" | "still" | "sit_on_window"
  }
}
```

## Candidate Technology

### Hands: Desktop Homunculus (Recommended)

- **Engine:** Bevy (Rust), cross-platform (macOS/Windows, Linux planned)
- **Model:** VRM 3D
- **Interface:** Built-in MCP Server (HTTP), 20+ tools: move, expression, animation, Webview, audio
- **License:** MIT / Apache-2.0
- **Maturity:** Early alpha (0.1.0), but architecture matches requirements well
- **Repo:** https://github.com/not-elm/desktop-homunculus

### Probe: Standalone Lightweight Program

Desktop Homunculus does not provide desktop probe. Need separate probe program for desktop state collection.

## Implementation Path

**Phase 1: Proof of concept (1–2 days)**

1. Run Desktop Homunculus, load VRM model
2. Send commands manually via MCP
3. Confirm Agent can control desktop pet via MCP Client

**Phase 2: Minimal probe (2–3 days)**

1. Implement minimal desktop probe
2. Push data via WebSocket

**Phase 3: Script standing (1 day)**

1. Design behavior script format
2. Implement script engine

**Phase 4: Agent intervention**

1. Agent can rewrite script anytime
2. Agent can selectively listen to events, control pet directly

## Out of Scope

- ❌ Desktop pet makes no AI decisions (all intelligence on Agent side)
- ❌ No built-in chat (chat via FreeAnima Gateway)
- ❌ No window content capture (title/process name only)
- ❌ No hard dependency on future Homunculus versions
