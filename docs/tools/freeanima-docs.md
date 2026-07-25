---
title: freeanima_docs ToolSet
---

# freeanima_docs ToolSet

On-demand Habitat ToolSet for reading product documentation under `docs/`. Load with:

```text
toolset_load(["freeanima_docs"])
```

Then use:

| Tool                    | Purpose                                                                       |
| ----------------------- | ----------------------------------------------------------------------------- |
| `freeanima_docs_list`   | List docs (`path` + `title`). Optional `prefix` (e.g. `cognition/`, `tools/`) |
| `freeanima_docs_get`    | Full Markdown by relative path (e.g. `product/architecture.md`)               |
| `freeanima_docs_search` | Keyword AND search over path, title, and body                                 |

`README.md` is listed first so agents can orient from the index.

## Path prefixes

| Prefix       | Use when asking…                            |
| ------------ | ------------------------------------------- |
| `product/`   | What is FreeAnima / data model?             |
| `cognition/` | How does memory, sleep, self, time work?    |
| `ui/`        | Visual foundations, components, UX patterns |
| `aspects/`   | Cross-cutting design planes (data, sync, …) |
| `modules/`   | What product capabilities exist?            |
| `tools/`     | Built-in ToolSet boundaries                 |
| `ops/`       | Install, security, RPC, remote access       |

## Corpus rules

- Source: repo `docs/**/*.md` (standalone builds embed the same tree).
- Skips `docs/.generated/` (translated builds).
- **Do not** put acceptance checklists, ephemeral QA notes, or IDE-only implementation rules in `docs/` — those belong outside this corpus (e.g. `.agent/rules/`).
