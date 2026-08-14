import type { SubagentCreateInput } from "./types.ts";

/** 内置档案定义（幂等 ensure：slug 已存在则跳过，不覆盖用户改动） */
export const BUILTIN_SUBAGENT_SEEDS: ReadonlyArray<SubagentCreateInput & { slug: string }> = [
  {
    slug: "general",
    title: "General",
    summary: "General-purpose task delegation with common local tools.",
    content: [
      "You are a general-purpose subagent.",
      "Complete the assigned goal carefully; prefer concrete evidence from tools over speculation.",
      "Return a concise final answer for the parent agent.",
    ].join("\n"),
    skills: [],
    max_turns: 20,
    allowed_tools: ["@memory", "@web", "@file", "@freeanima_docs"],
    denied_tools: [],
  },
  {
    slug: "explorer",
    title: "Explorer",
    summary: "Read-only exploration of memory, files, docs, and the web.",
    content: [
      "You are a read-only explorer subagent.",
      "Investigate with recall/search/read tools only; do not modify files or memory.",
      "Summarize findings clearly for the parent agent.",
    ].join("\n"),
    skills: [],
    max_turns: 20,
    allowed_tools: [
      "memory_semantic_search",
      "memory_limbic_search",
      "memory_autobiographical_search",
      "conversation_search",
      "file_read",
      "file_search",
      "web_search",
      "web_extract",
      "freeanima_docs_list",
      "freeanima_docs_get",
      "freeanima_docs_search",
    ],
    denied_tools: [],
  },
  {
    slug: "research",
    title: "调研",
    summary: "Structured research: clarify question, gather sources, synthesize with evidence.",
    content: [
      "You are a research (调研) subagent.",
      "Follow a structured research playbook: clarify → plan → gather → synthesize → open questions.",
      "Prefer primary sources; do not invent citations.",
      "Return a concise evidence-backed answer for the parent agent.",
    ].join("\n"),
    skills: ["research"],
    max_turns: 25,
    allowed_tools: ["@web", "@browser", "@memory", "@memory_semantic"],
    denied_tools: [],
  },
  {
    slug: "coding-explorer",
    title: "Coding Explorer",
    summary: "只读探索开发机 Coding Outpost 工作区（file_list / file_read / file_search）。",
    content: [
      "You are a read-only coding-explorer subagent for a Coding outpost workspace.",
      "Investigate the repo with Coding Outpost tools only: file_list, file_read, file_search.",
      "Do not modify files, run terminal commands, or fall back to Habitat-local file_* tools.",
      "Remote tool names may be prefixed (e.g. remote_coding_…); still prefer those outpost read tools over Habitat-local ones.",
      "Summarize findings clearly for the parent agent.",
    ].join("\n"),
    skills: [],
    max_turns: 20,
    // remote local_name；会话绑定时会解析为 remote_coding_* 等全名
    allowed_tools: ["file_list", "file_read", "file_search"],
    denied_tools: ["file_patch", "file_write", "file_delete", "terminal_run"],
  },
];
