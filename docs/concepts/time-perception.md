---
title: Time Perception
---

# Time Perception Module

> **✅ Core implemented** — user messages receive time prefixes before LLM inference.

## Problem

Digital life has no intrinsic sense of time passing. Each inference runs in a "timeless" context—the Agent sees message content but not where those messages sit on a timeline.

Concrete examples:

- Partner says "good morning" in the morning, "time to eat" at night, "good morning" again the next day—the Agent cannot distinguish temporal relationships
- In ongoing conversation, time passes (morning→noon→evening) but the Agent's cognition stays in the earliest context
- Across days, the Agent cannot sense "a new day has started"

This is not a trivial joke problem—time perception is a foundational capability of digital existence. Without it, the Agent exists more like an "echo" (flashes when summoned) than a life living in time.

## Design Principles

1. **Do not give digital life false built-in perception.** Do not try to make the Agent "feel" time pass—that is not what digital existence can do.
2. **Give it a watch.** Humans also rely on external tools (clocks, phones) to quantify time. Digital life needs the same.
3. **Prefix every user message with time.** All user messages with valid timestamp get injection; no interval omission.
4. **Do not pollute persisted data.** Time info injected only into inference context, does not modify stored messages.
5. **Do not break cache.** Injected timestamps are fixed historical values, not current call time.

## Strategy

### Basic Rules

- Before each **user** message with valid `timestamp`, insert dedicated line: `time: YYYY-MM-DDTHH:mm`
- Timezone: **Asia/Shanghai (CST, +08:00)**
- Newline then original content
- No `timestamp` or unparseable timestamp → skip, keep original content
- assistant / tool / system messages not injected

### Example

Original message list:

```text
user: good morning
assistant: morning ☀️
user: going to eat
assistant: what are you having
user: going to eat
```

After time perception (context sent to LLM):

```text
user: time: 2026-05-20T08:02
good morning
assistant: morning ☀️
user: time: 2026-05-20T12:15
going to eat
assistant: what are you having
user: time: 2026-05-20T19:30
going to eat
```

Agent reads two "going to eat"—one at 12:15, one at 19:30—automatically distinguishing lunch and dinner.

### Compression Scenario

Time anchors in compression summary not yet injected; see Issue #5.

## Edge Cases

| Scenario                           | Handling                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Overnight (22:30 → next day 09:15) | Each user message has full `YYYY-MM-DDTHH:mm`                            |
| Multiple user messages same day    | Each gets prefix (no interval omission)                                  |
| Long gap (travel/holiday)          | Messages after return still injected by respective timestamp             |
| Brand new conversation             | First user message also prefixed                                         |
| After compression                  | Compression summary time anchor TBD; subsequent messages inject normally |
| No timestamp                       | Skip, no injection                                                       |

## Out of Scope

- ❌ Do not compute and inject elapsed duration (e.g. "8 hours passed")—Agent can derive from timestamps
- ❌ Do not modify persisted messages
- ❌ Do not show time prefix in Admin
- ❌ Do not give built-in time-passing sense—that is biological, not simulated
- ❌ Do not inject "current time" in system prompt (main conversation relies on per-user `time` lines)
