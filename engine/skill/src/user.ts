import { toolError, toolResult } from "@freeanima/engine-tool";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/service-config";
import { CST_OFFSET_MS } from "@freeanima/engine-util";
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
    return toolError(
      `Skill '${trimmedName}' already exists. Use a different name, or delete and recreate.`,
    );
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
    message: `Skill '${trimmedName}' created and registered`,
  });
}

export function deleteUserSkill(skills: SkillRegistry, name: string): string {
  const trimmed = name.trim();
  const def = skills.get(trimmed);
  if (!def) return toolError(`Skill '${trimmed}' is not registered`);
  if (def.source !== USER_SKILLS_SOURCE) {
    return toolError(
      `Skill '${trimmed}' is a built-in skill (${def.source ?? "builtin"}); cannot delete`,
    );
  }
  const path = join(def.directory, `${trimmed}.md`);
  if (!existsSync(path)) {
    skills.unregister(trimmed);
    return toolResult({
      ok: true,
      name: trimmed,
      message: `Skill '${trimmed}' file missing; removed from registry`,
    });
  }
  unlinkSync(path);
  skills.unregister(trimmed);
  return toolResult({ ok: true, name: trimmed, message: `Skill '${trimmed}' deleted` });
}

export function viewUserSkill(skills: SkillRegistry, name: string): string {
  const trimmed = name.trim();
  const raw = readSkillFile(skills, trimmed);
  if (raw == null) return toolError(`Skill '${trimmed}' does not exist`);
  return toolResult({ name: trimmed, content: raw.trim() });
}
