/**
 * Prompt structure wrappers: XML outer shell, Markdown-ok inner body.
 * Tags are prompt boundaries (not a strict XML parser); body is not entity-escaped.
 *
 * Budget truncation must run on the body *before* wrapping so closing tags stay intact.
 */

export type PromptXmlAttrs = Readonly<Record<string, string>>;

/** Stable tag names for machine-injected prompt payloads */
export const PROMPT_XML_TAGS = {
  selfLayer: "self_layer",
  residentMemory: "resident_memory",
  toolsets: "toolsets",
  passiveMemory: "passive_memory",
  notification: "notification",
  temporalPeers: "temporal_peers",
  temporalSummary: "temporal_summary",
  time: "time",
  skill: "skill",
  channel: "channel",
  worldContext: "world_context",
  skills: "skills",
  subagents: "subagents",
  animaUri: "anima_uri",
  memoryCitation: "memory_citation",
  memoryRecall: "memory_recall",
  envHealth: "env_health",
  userActivity: "user_activity",
  projectContext: "project_context",
  projectRulesScoped: "project_rules_scoped",
  projectSkills: "project_skills",
  projectAgents: "project_agents",
  projectMcp: "project_mcp",
  autoLlmProtocol: "auto_llm_protocol",
  autoLlmTaskSpec: "auto_llm_task_spec",
  autoLlmTaskParams: "auto_llm_task_params",
  relatedMemories: "related_memories",
  sourceData: "source_data",
  /** 子代理角色（具名 content / 临时 instructions + opt-in） */
  subagentRole: "subagent_role",
  /** 子代理本次目标（goal + context） */
  subagentGoal: "subagent_goal",
  /** Reflect 巩固：本批语义记忆清单 */
  semanticMemories: "semantic_memories",
} as const;

export type PromptXmlTag = (typeof PROMPT_XML_TAGS)[keyof typeof PROMPT_XML_TAGS];

function formatAttrs(attrs: PromptXmlAttrs | undefined): string {
  if (!attrs) return "";
  let out = "";
  for (const [key, value] of Object.entries(attrs)) {
    out += ` ${key}="${value.replaceAll('"', "&quot;")}"`;
  }
  return out;
}

export type WrapPromptXmlOptions = {
  attrs?: PromptXmlAttrs;
  /** Single-line `<tag>body</tag>` (e.g. time); default is multiline open/close. */
  inline?: boolean;
};

/** Char overhead of `<tag>…</tag>` excluding body (multiline open/close + newlines). */
export function promptXmlWrapOverhead(tag: string, opts?: WrapPromptXmlOptions): number {
  const attrStr = formatAttrs(opts?.attrs);
  if (opts?.inline) {
    return `<${tag}${attrStr}>`.length + `</${tag}>`.length;
  }
  return `<${tag}${attrStr}>\n`.length + `\n</${tag}>`.length;
}

/** Wrap non-empty body in `<tag>…</tag>`; empty/whitespace → "". */
export function wrapPromptXml(tag: string, body: string, opts?: WrapPromptXmlOptions): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  const attrStr = formatAttrs(opts?.attrs);
  if (opts?.inline) return `<${tag}${attrStr}>${trimmed}</${tag}>`;
  return `<${tag}${attrStr}>\n${trimmed}\n</${tag}>`;
}

/**
 * Optional natural-language frame outside the tag + XML-wrapped payload.
 * Prefer frame outside so protocol prose is not mixed into the data shell.
 */
export function wrapPromptXmlSection(
  tag: string,
  body: string,
  opts?: { frame?: string; attrs?: PromptXmlAttrs; inline?: boolean },
): string {
  const wrapped = wrapPromptXml(tag, body, {
    ...(opts?.attrs ? { attrs: opts.attrs } : {}),
    ...(opts?.inline ? { inline: true } : {}),
  });
  if (!wrapped) return "";
  const frame = opts?.frame?.trim();
  return frame ? `${frame}\n\n${wrapped}` : wrapped;
}

/** Truncate body so that frame + wrap(body) fits `budgetChars` (closing tag preserved). */
export function truncatePromptBodyForXmlBudget(
  body: string,
  budgetChars: number,
  wrap: { tag: string; frame?: string; attrs?: PromptXmlAttrs; inline?: boolean },
  marker = "\n\n[... truncated by section budget ...]",
): { body: string; truncated: boolean } {
  const trimmed = body.trim();
  const frame = wrap.frame?.trim() ?? "";
  const frameOverhead = frame.length > 0 ? frame.length + 2 : 0;
  const tagOverhead = promptXmlWrapOverhead(wrap.tag, {
    ...(wrap.attrs ? { attrs: wrap.attrs } : {}),
    ...(wrap.inline ? { inline: true } : {}),
  });
  const maxBody = Math.max(0, budgetChars - frameOverhead - tagOverhead);
  if (trimmed.length <= maxBody) {
    return { body: trimmed, truncated: false };
  }
  if (maxBody === 0) {
    return { body: "", truncated: true };
  }
  const useMarker = marker.length <= maxBody ? marker : "…";
  const keep = Math.max(0, maxBody - useMarker.length);
  return { body: `${trimmed.slice(0, keep)}${useMarker}`, truncated: true };
}
