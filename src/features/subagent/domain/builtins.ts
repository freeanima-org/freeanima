import { getResolvedWorldContext } from "@freeanima/host/core/config";

import { createSubagent, getSubagentBySlug } from "./subagent-store.ts";
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
];

/** 幂等种子内置 subagent 到 agent 私有 world */
export async function seedBuiltinSubagents(): Promise<number> {
  const worldId = getResolvedWorldContext().agent_world_id;
  let seeded = 0;
  for (const def of BUILTIN_SUBAGENT_SEEDS) {
    const existing = await getSubagentBySlug(worldId, def.slug);
    if (existing) continue;
    await createSubagent(worldId, def);
    seeded += 1;
  }
  return seeded;
}
