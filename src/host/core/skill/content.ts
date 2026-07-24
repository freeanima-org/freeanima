import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillRegistry } from "./registry.ts";

export type SkillFrontmatter = {
  name?: string;
  description?: string;
  created?: string;
};

export function skillFilePath(directory: string, name: string): string {
  return join(directory, `${name}.md`);
}

export function parseFrontmatter(text: string): SkillFrontmatter {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return {};
  const out: SkillFrontmatter = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (line === "---") break;
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === "name") out.name = value;
    if (key === "description") out.description = value;
    if (key === "created") out.created = value;
  }
  return out;
}

export function stripFrontmatter(text: string): string {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return text.trim();
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      return lines
        .slice(i + 1)
        .join("\n")
        .trim();
    }
  }
  return text.trim();
}

export function readSkillFile(skills: SkillRegistry, name: string): string | null {
  const def = skills.get(name);
  if (!def) return null;
  const path = skillFilePath(def.directory, name);
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

/** Read skill body (strip frontmatter) */
export function readSkillBody(skills: SkillRegistry, name: string): string | null {
  const raw = readSkillFile(skills, name);
  if (raw == null) return null;
  const body = stripFrontmatter(raw);
  return body.trim() ? body : null;
}

export function readSkillDescriptionFromFile(directory: string, name: string): string {
  const path = skillFilePath(directory, name);
  if (!existsSync(path)) return "";
  try {
    const fm = parseFrontmatter(readFileSync(path, "utf-8"));
    return fm.description?.trim() ?? "";
  } catch {
    return "";
  }
}
