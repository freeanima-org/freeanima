---
title: Camofox Browser Profile & Session
---

# Camofox Browser Profile & Session

> Browser tools talk to Camofox over HTTP. **Profile** holds login state; **session** is a work line under that profile.

Configure under Habitat settings → Advanced → **browser** / **camofox** (`browser.camofox.*` in `habitat_runtime_config`).

## Profile vs session

| Concept     | Config / field                                                            | What it owns                                               |
| ----------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Profile** | Camofox `userId` (`user_id`, or derived when `managed_persistence`)       | Cookies, login, local storage — “who is browsing”          |
| **Session** | Camofox `sessionKey` (`session_key`, or derived per Habitat conversation) | Tab / task line under that profile — create and adopt tabs |

One profile can have many sessions. Same profile + different sessions share login state but keep separate tab lines.

Habitat `conversationId` is only the in-process map key for the cached Camofox session object; it is not Camofox’s `sessionKey` itself (often derived from it).

## Resolution order

When a Habitat conversation first opens a Camofox session:

1. **`user_id` set** → use that profile; `session_key` if set, else `task_` + conversation id prefix. Ignores `managed_persistence`.
2. Else **`managed_persistence` not false** (default **true**) → stable `userId` from `~/.anima/browser_auth/camofox`; `sessionKey` derived per conversation.
3. Else (`managed_persistence: false`) → ephemeral random `userId` — no persistent profile.

`session_key` alone does nothing; it only applies when `user_id` is set.

## Fields

| Field                 | Default (when unset) | Meaning                                                                  |
| --------------------- | -------------------- | ------------------------------------------------------------------------ |
| `base_url`            | (required for tools) | Camofox REST base URL                                                    |
| `timeout_ms`          | `30000`              | Per-request HTTP timeout                                                 |
| `managed_persistence` | `true`               | Reuse a stable local profile when `user_id` is unset                     |
| `adopt_existing_tab`  | `true`               | After restart, try to adopt an existing tab for the same profile/session |
| `user_id`             | unset                | Explicit Camofox profile id (highest priority)                           |
| `session_key`         | unset                | Explicit session key under that profile (only with `user_id`)            |

Unset booleans are treated as **on** (`!== false`). Set explicitly to `false` to disable.

## Per-call profile (`browser_navigate.user_id`)

`browser_navigate` accepts an optional `user_id` (Camofox profile). Other `browser_*` tools keep using the conversation’s cached session.

| Call                                       | Behavior                                                                                                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Omit `user_id`                             | Reuse the conversation session if one exists; otherwise resolve via Habitat config (order above)                                                                                                   |
| Pass `user_id` matching the cached profile | Navigate on the current tab                                                                                                                                                                        |
| Pass a different `user_id`                 | Drop the in-process cache for this conversation and open a new tab under that profile (`sessionKey` = `task_` + conversation id prefix). Does **not** delete the previous Camofox profile remotely |

A successful navigate result includes `user_id` so the agent can confirm the active profile. Omitting `user_id` after a prior tool override keeps that override for the conversation; it does not fall back to config until a new session is created (e.g. process restart or session cleared).

Tool override applies only to that Habitat conversation’s cache. Habitat `browser.camofox.user_id` remains the default when no tool override is in effect.

## Recommended setups

| Goal                                      | Config                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Remember logins on this Habitat (default) | Leave fields unset, or `managed_persistence: true`                     |
| Ephemeral browsing (no shared login)      | `managed_persistence: false`                                           |
| Share / pin a Camofox profile             | Set `user_id`; add `session_key` only if you need a fixed session line |
| Switch profiles inside one conversation   | Pass `user_id` on `browser_navigate`                                   |

## See also

Implementation: `src/host/capabilities/tools/browser-camofox.ts`.
