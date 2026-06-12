import { toolError, toolResult } from "@freeanima/mechanism-tool";
import { readSkillBody } from "./content.ts";
import { type SkillDef, type SkillRegistry } from "./registry.ts";

export type SkillListEntry = {
  name: string;
  description: string;
  source?: string;
  directory: string;
};

function toListEntry(def: SkillDef): SkillListEntry {
  return {
    name: def.name,
    description: def.description,
    source: def.source,
    directory: def.directory,
  };
}

/** load_skill tool: put skill body into tool message context */
export function loadSkillIntoContext(skills: SkillRegistry, name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return toolError("Skill name cannot be empty");
  const def = skills.get(trimmed);
  if (!def) return toolError(`Skill '${trimmed}' is not registered`);
  const content = readSkillBody(skills, trimmed);
  if (!content) return toolError(`Skill '${trimmed}' content is empty or file missing`);
  return toolResult({
    skill: trimmed,
    description: def.description,
    source: def.source,
    content,
  });
}

export function listSkillsForTool(skills: SkillRegistry): string {
  const list = skills.list();
  if (!list.length) {
    return toolResult({ skills: [], total: 0, message: "No registered skills." });
  }
  return toolResult({
    skills: list.map(toListEntry),
    total: list.length,
  });
}

export function searchSkillsForTool(skills: SkillRegistry, query: string): string {
  const results = skills.search(query);
  return toolResult({
    query: query.trim(),
    skills: results.map(toListEntry),
    total: results.length,
  });
}

/** Cron etc. no-tool turns: prefix skill body to prompt */
export function formatSkillsPrefix(skills: SkillRegistry, names: string[]): string {
  const parts: string[] = [];
  for (const name of names) {
    const body = readSkillBody(skills, name);
    if (body) parts.push(`<skill name="${name}">\n${body.trim()}\n</skill>`);
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
