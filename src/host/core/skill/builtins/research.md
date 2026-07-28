---
name: research
description: Structured research playbook — clarify question, gather sources, synthesize findings.
allowed-tools: @web @browser memory_recall memory_semantic_search
origin: builtin
status: active
license: MIT
compatibility: Requires @web and/or @browser ToolSets when fetching live sources.
metadata:
  freeanima.origin: builtin
---

# Research

Use this skill when the user needs investigation, comparison, or evidence-backed answers.

## Steps

1. **Clarify** the research question and success criteria.
2. **Plan** sources (docs, web, memory) and constraints.
3. **Gather** with available tools; prefer primary sources.
4. **Synthesize** findings with citations / links.
5. **Open questions** — note gaps and next probes.

## Tool notes

- Prefer `@web` (`web_search` / `web_extract`) for search and URL extraction; `@browser` for interactive live pages.
- Use memory tools for prior knowledge.
- Do not invent citations.
