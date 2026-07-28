---
title: Skills
---

# Skills

Procedural playbooks for the digital life: **ToolSets are the hands; skills are the techniques.**

## Progressive disclosure

Aligned with [Agent Skills](https://agentskills.io/specification) / OpenClaw / Hermes / Pi:

1. **Catalog** — `name` + short `description` in the system prompt (budget / compact when large)
2. **Body** — full Markdown instructions via `skill_load` (not inlined into the system prompt)
3. **Resources** — optional companion entities (`skill_resource` / `object_file`); load on demand

Do **not** dump every skill body into the system prompt.

## Storage

- **One skill = one entity** (`primary_component = skill`)
- Dual-layer worlds: **Commons** (`world_config.common`) for shared/builtin skills; **agent private** for user/evolved skills
- Catalog resolution: `commons ∪ agent_private`, **private overrides commons** on same name
- `title` = name, `summary` = description, `content` = instruction body
- **Not** object storage; **not** runtime file tree under `~/.anima/skills` (Markdown+YAML is **import/export** only)

### agentskills.io mapping

| agentskills                         | FreeAnima                                                             |
| ----------------------------------- | --------------------------------------------------------------------- |
| `name`                              | `entities.title` (validated: lowercase, digits, hyphens)              |
| `description`                       | `entities.summary`                                                    |
| body Markdown                       | `entities.content`                                                    |
| `license`                           | `skill.license`                                                       |
| `compatibility`                     | `skill.compatibility` (environment NL; ≠ tool list)                   |
| `allowed-tools` (space-separated)   | `skill.allowed_tools[]` (also accepts arrays / `@ToolSet`)            |
| `metadata`                          | `skill.metadata` (+ `freeanima.*` on export)                          |
| `scripts` / `references` / `assets` | companion `skill_resource` or `object_file` refs in `skill.resources` |
| —                                   | `denied_tools`, `origin`, `status` (FreeAnima extensions)             |

## Capability Policy (tools)

Skills participate in **Capability Policy** — see [`architecture.md`](../product/architecture.md).

| Actor                                 | `allowed_tools` | `denied_tools`  |
| ------------------------------------- | --------------- | --------------- |
| Skill                                 | Primary         | Optional / rare |
| Caller (cron, sleep, future subagent) | Optional        | Primary         |

**Visible chat:** default ToolSets (includes `skill`); user present.  
**Invisible runs:** least privilege — default deny all tools; effective set ≈ union of loaded skills’ allows, minus caller denies. No skills (and no caller allow) ⇒ no tools.

**Data** allow/deny under the same umbrella is **reserved** (not implemented).

## Habitat UI

Habitat admin: read-only **skill list + detail** (`skill.list` / `skill.get`).

## Self-evolution interface (#46)

| Outcome            | Action                                             |
| ------------------ | -------------------------------------------------- |
| Reusable technique | Upsert skill with `origin=evolved`, `status=draft` |
| Confirmed          | `status=active` (enters system-prompt catalog)     |
| Discard            | `status=discarded` or delete                       |

## Non-goals

- Multi-agent dispatch of skills
- Skill sprawl governance
- Runtime data Capability Policy
- Restoring Mask presets / `masks.yaml`
