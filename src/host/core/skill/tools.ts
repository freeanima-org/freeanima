import { omitUndefined } from "@freeanima/host/core/util";
import { toolError, toolResult } from "@freeanima/host/core/tool";
import type { SkillOrigin } from "@freeanima/host/core/db/schema/entity";
import type { SkillDef, SkillRegistry } from "./registry.ts";
import {
  createDbSkill,
  deleteDbSkill,
  exportSkillMarkdown,
  importSkillMarkdown,
  patchDbSkill,
  updateDbSkill,
} from "./store.ts";

export type SkillListEntry = {
  name: string;
  description: string;
  origin: string;
  status: string;
  entity_id: number;
  world_id: number;
  allowed_tools: readonly string[];
  source?: string;
};

function toListEntry(def: SkillDef): SkillListEntry {
  return omitUndefined({
    name: def.name,
    description: def.description,
    origin: def.origin,
    status: def.status,
    entity_id: def.entityId,
    world_id: def.worldId,
    allowed_tools: def.allowed_tools,
    source: def.source,
  });
}

function parseStringList(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

function parseOrigin(raw: unknown): SkillOrigin | undefined {
  if (raw === "user" || raw === "evolved" || raw === "imported") return raw;
  return undefined;
}

export async function loadSkillIntoContext(skills: SkillRegistry, name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) return toolError("Skill name cannot be empty");
  const def = skills.get(trimmed);
  if (def) {
    const content = def.content.trim();
    if (!content) return toolError(`Skill '${trimmed}' content is empty`);
    return toolResult({
      skill: trimmed,
      description: def.description,
      origin: def.origin,
      allowed_tools: def.allowed_tools,
      content,
    });
  }

  const { getToolConversationId } = await import("@freeanima/host/core/tool/tool-context.ts");
  const { resolveProjectSkillOverlay } = await import("./project-overlay.ts");
  const hit = await resolveProjectSkillOverlay(getToolConversationId() ?? null, trimmed);
  if (hit?.content?.trim()) {
    return toolResult({
      skill: hit.name,
      description: hit.description,
      origin: "project",
      allowed_tools: [],
      content: hit.content.trim(),
      path: hit.path,
    });
  }
  return toolError(`Skill '${trimmed}' is not registered`);
}

export function listSkillsForTool(skills: SkillRegistry): string {
  const list = skills.listActive();
  if (list.length === 0) {
    return toolResult({ skills: [], total: 0, message: "No registered skills." });
  }
  return toolResult({
    skills: list.map(toListEntry),
    total: list.length,
  });
}

export function searchSkillsForTool(skills: SkillRegistry, query: string): string {
  const results = skills.search(query).filter((s) => s.status === "active");
  return toolResult({
    query: query.trim(),
    skills: results.map(toListEntry),
    total: results.length,
  });
}

export async function createUserSkill(
  skills: SkillRegistry,
  name: string,
  description: string,
  content: string,
  opts?: {
    origin?: SkillOrigin;
    allowed_tools?: string[];
    denied_tools?: string[];
  },
): Promise<string> {
  try {
    const origin = opts?.origin ?? "user";
    const def = await createDbSkill(skills, name, description, content, {
      origin,
      status: "active",
      ...omitUndefined({
        allowed_tools: opts?.allowed_tools,
        denied_tools: opts?.denied_tools,
      }),
    });
    return toolResult({
      ok: true,
      name: def.name,
      description: def.description,
      origin: def.origin,
      entity_id: def.entityId,
      message: `Skill '${def.name}' created (origin=${def.origin})`,
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

/** Parse tool args for skill_create (shared by capabilities registration). */
export function parseCreateSkillArgs(args: Record<string, unknown>): {
  name: string;
  description: string;
  content: string;
  origin?: SkillOrigin;
  allowed_tools?: string[];
  denied_tools?: string[];
} {
  return omitUndefined({
    name: String(args.name ?? ""),
    description: String(args.description ?? ""),
    content: String(args.content ?? ""),
    origin: parseOrigin(args.origin),
    allowed_tools: parseStringList(args.allowed_tools),
    denied_tools: parseStringList(args.denied_tools),
  });
}

export async function patchUserSkill(
  skills: SkillRegistry,
  name: string,
  oldString: string,
  newString: string,
  replaceAll?: boolean,
): Promise<string> {
  try {
    const def = await patchDbSkill(skills, name, oldString, newString, {
      replace_all: replaceAll === true,
    });
    return toolResult({
      ok: true,
      name: def.name,
      message: `Skill '${def.name}' patched`,
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

export async function updateUserSkill(
  skills: SkillRegistry,
  name: string,
  patch: {
    description?: string;
    content?: string;
    allowed_tools?: string[];
    denied_tools?: string[];
  },
): Promise<string> {
  try {
    const def = await updateDbSkill(skills, name, patch);
    return toolResult({
      ok: true,
      name: def.name,
      message: `Skill '${def.name}' updated`,
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

export async function deleteUserSkill(skills: SkillRegistry, name: string): Promise<string> {
  try {
    await deleteDbSkill(skills, name);
    return toolResult({ ok: true, name: name.trim(), message: `Skill '${name.trim()}' deleted` });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

export async function viewUserSkill(skills: SkillRegistry, name: string): Promise<string> {
  try {
    const md = await exportSkillMarkdown(skills, name);
    return toolResult({ name: name.trim(), content: md });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

export async function importUserSkill(skills: SkillRegistry, markdown: string): Promise<string> {
  try {
    const def = await importSkillMarkdown(skills, markdown, { origin: "imported" });
    return toolResult({
      ok: true,
      name: def.name,
      entity_id: def.entityId,
      message: `Skill '${def.name}' imported`,
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

export async function exportUserSkill(skills: SkillRegistry, name: string): Promise<string> {
  return viewUserSkill(skills, name);
}

/** Cron 等：把技能正文前缀到 prompt */
export function formatSkillsPrefix(skills: SkillRegistry, names: string[]): string {
  const parts: string[] = [];
  for (const name of names) {
    const def = skills.get(name);
    if (def?.content.trim()) {
      parts.push(`<skill name="${name}">\n${def.content.trim()}\n</skill>`);
    }
  }
  return parts.join("\n\n");
}

export function prependSkillsToPrompt(
  skills: SkillRegistry,
  prompt: string,
  skillNames: string[],
): string {
  const prefix = formatSkillsPrefix(skills, skillNames);
  if (!prefix) return prompt;
  return `${prefix}\n\n${prompt}`;
}

/** 从已加载技能收集策略片段（invisible 场景） */
export function skillPolicyFragments(skills: SkillRegistry, names: readonly string[]) {
  return names
    .map((n) => skills.get(n))
    .filter((d): d is SkillDef => d != null)
    .map((d) => ({
      allowed_tools: d.allowed_tools,
      denied_tools: d.denied_tools,
    }));
}
