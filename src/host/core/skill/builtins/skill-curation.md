---
name: skill-curation
description: Meta-skill — when and how to create, patch, merge, or delete procedural skills (self-evolution and library maintenance).
allowed-tools: @skill
origin: builtin
status: active
license: MIT
compatibility: Used by skill review bypass (hard-injected) and when the agent explicitly loads it for curation.
metadata:
  freeanima.origin: builtin
  freeanima.role: meta
---

# Skill curation

Skills are **reusable procedures** (how to do a class of tasks). They are not facts, not one-off notes, and not a dump of the last conversation.

## Create (`skill_create`, `origin=evolved`)

Create when:

- A non-trivial workflow succeeded and will likely recur
- Errors or dead ends were overcome and the working path is clear
- The user corrected the approach and the corrected path should stick
- The user explicitly asked to remember a procedure

Always:

- Short `description` (when to use)
- Actionable steps + pitfalls
- Fill `allowed_tools` (tool names or `@ToolSet`) for invisible/automation boundaries
- Prefer a specific name (`deploy-staging-fly`) over vague (`stuff`)

## Patch (`skill_patch`) — preferred over rewrite

Patch when an existing skill is stale, missing a pitfall, or has a wrong step.

- `skill_search` / `skill_view` first
- Prefer `skill_patch` (`old_string` / `new_string`) over full `skill_update`
- Do not create a near-duplicate; merge into the best existing skill

## Delete / merge

Delete (or absorb into another skill then delete) when:

- Duplicate or overlapping skills
- One-off content that will not recur
- Fully superseded by a better skill

Never delete builtin skills.

## Not a skill

| Content                          | Put elsewhere     |
| -------------------------------- | ----------------- |
| Ephemeral facts / preferences    | Memory            |
| Easily re-looked-up reference    | Docs / web        |
| Deterministic multi-step graphs  | Workflow (future) |
| Session-only paths / debug dumps | Discard (noop)    |

## Quality bar

- Prefer **noop** over low-value skills
- Keep bodies short and executable
- One skill = one job
- After using a skill and hitting an uncovered failure, **patch immediately**
