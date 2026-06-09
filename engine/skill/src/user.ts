import { toolError, toolResult } from "@freeanima/engine-tool";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CST_OFFSET_MS, PATHS } from "@freeanima/service-config";
import { readSkillFile } from "./content.ts";
import { type SkillRegistry, registerSkillsFromDirectory } from "./registry.ts";

export const USER_SKILLS_SOURCE = "user";

const SKILL_TEMPLATE = (name: string, description: string, created: string, content: string) =>
  `---
name: ${name}
description: ${description}
created: ${created}
---

# ${name}

${content}
`;

function nowDate(): string {
  const d = new Date(Date.now() + CST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function userSkillsDirectory(): string {
  return join(PATHS.home, "skills");
}

function ensureUserSkillsDir(): string {
  const dir = userSkillsDirectory();
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function registerUserSkillsFromHome(skills: SkillRegistry): number {
  const dir = userSkillsDirectory();
  if (!existsSync(dir)) return 0;
  return registerSkillsFromDirectory(skills, dir, { source: USER_SKILLS_SOURCE });
}

export function createUserSkill(
  skills: SkillRegistry,
  name: string,
  description: string,
  content: string,
): string {
  const trimmedName = name.trim();
  const dir = ensureUserSkillsDir();
  const path = join(dir, `${trimmedName}.md`);
  if (existsSync(path)) {
    return toolError(`技能 '${trimmedName}' 已存在。用不同的名字，或先删除再重建。`);
  }
  const skillText = SKILL_TEMPLATE(trimmedName, description, nowDate(), content.trim());
  writeFileSync(path, skillText, "utf-8");
  skills.register({
    name: trimmedName,
    description: description.trim(),
    directory: dir,
    source: USER_SKILLS_SOURCE,
  });
  return toolResult({
    ok: true,
    name: trimmedName,
    description: description.trim(),
    message: `技能 '${trimmedName}' 已创建并注册`,
  });
}

export function deleteUserSkill(skills: SkillRegistry, name: string): string {
  const trimmed = name.trim();
  const def = skills.get(trimmed);
  if (!def) return toolError(`技能 '${trimmed}' 未注册`);
  if (def.source !== USER_SKILLS_SOURCE) {
    return toolError(`技能 '${trimmed}' 为内置技能（${def.source ?? "builtin"}），不可删除`);
  }
  const path = join(def.directory, `${trimmed}.md`);
  if (!existsSync(path)) {
    skills.unregister(trimmed);
    return toolResult({
      ok: true,
      name: trimmed,
      message: `技能 '${trimmed}' 文件不存在，已从注册表移除`,
    });
  }
  unlinkSync(path);
  skills.unregister(trimmed);
  return toolResult({ ok: true, name: trimmed, message: `技能 '${trimmed}' 已删除` });
}

export function viewUserSkill(skills: SkillRegistry, name: string): string {
  const trimmed = name.trim();
  const raw = readSkillFile(skills, trimmed);
  if (raw == null) return toolError(`技能 '${trimmed}' 不存在`);
  return toolResult({ name: trimmed, content: raw.trim() });
}
