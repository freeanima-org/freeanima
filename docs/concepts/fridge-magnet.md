---
title: Fridge Magnet
---

# Fridge Magnet

Cross-turn sticky notes for digital-life working memory. Content lives in Redis with TTL; at inference time it **manifests** in the conversation stream — not in the persisted system prompt.

## Three layers

| Layer         | Role                                   | Persistence                   |
| ------------- | -------------------------------------- | ----------------------------- |
| Write         | `fridge_magnet_write`, dream reminders | —                             |
| Storage       | Redis `fridge-magnet:*` keys           | Redis (TTL)                   |
| Consciousness | Runtime message before each LLM call   | **Not stored** in PG messages |

## Consciousness representation

When the board has at least one non-empty entry **and** the last message in the runtime list is `user`, the mechanism materializes **exactly one** assistant turn:

```yaml
role: assistant
name: fridge_context
content: |
  Below are cross-turn sticky notes you wrote for yourself…
  ## Fridge magnets
  (fridge-magnet block with session:id entries)
```

This is the **standard form** of fridge magnets in consciousness — not a generic “injection transport” into user or system roles.

### Trigger rules

- **Manifest**: last message is `user`, Redis has ≥1 magnet with non-whitespace `value`
- **Do not manifest**: last message is `assistant`, `tool`, `system`, etc. (tool-loop middle turns have no board)
- **Empty board**: no manifest message; no placeholder

Each `beforeLlmCall` pass strips any prior `fridge_context` assistant from the runtime copy, then re-manifests if rules allow.

### Why not user or system?

- Prepending to **user** text caused the model to attribute notes to the human partner.
- Appending to **system** would invalidate prefix cache for stable self-layer content; the board also changes frequently.

`assistant(name=fridge_context)` keeps the stable system prefix cacheable, places notes near the current user turn, and signals “self working memory” rather than partner speech.

## Legacy migration

Older builds prepended a fridge-magnet-tagged fenced block inside user message bodies. Runtime still strips those blocks from user content; new manifests use the assistant form only.

## Related

- Tools: `fridge_magnet_write`, `fridge_magnet_dismiss`
- Dream reminders: [`dream.md`](dream.md)
- Install / Redis: [`guide/install.md`](../guide/install.md)
