import { toolError, toolResult } from "@freeanima/engine-tool";
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

/** load_skill 工具：将技能正文放入 tool 消息上下文 */
export function loadSkillIntoContext(skills: SkillRegistry, name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return toolError("技能名称不能为空");
  const def = skills.get(trimmed);
  if (!def) return toolError(`技能 '${trimmed}' 未注册`);
  const content = readSkillBody(skills, trimmed);
  if (!content) return toolError(`技能 '${trimmed}' 内容为空或文件不存在`);
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
    return toolResult({ skills: [], total: 0, message: "暂无已注册技能。" });
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

/** Cron 等无 tool 回合场景：将技能正文前缀到 prompt */
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
