import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { PATHS, CST_OFFSET_MS } from "@freeanima/service-config";
import { z } from "zod";

const activeSkillsSchema = z.array(z.string());

const SKILLS_DIR = () => join(PATHS.home, "skills");
const ACTIVE_FILE = () => join(PATHS.home, "active_skills.json");

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

function ensureSkillsDir(): void {
  mkdirSync(SKILLS_DIR(), { recursive: true });
}

function skillPath(name: string): string {
  return join(SKILLS_DIR(), `${name}.md`);
}

function getActive(): string[] {
  const path = ACTIVE_FILE();
  if (!existsSync(path)) return [];
  try {
    const data = readFileSync(path, "utf-8").trim();
    if (!data) return [];
    const parsed: unknown = JSON.parse(data);
    const result = activeSkillsSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function saveActive(names: string[]): void {
  mkdirSync(PATHS.home, { recursive: true });
  writeFileSync(ACTIVE_FILE(), JSON.stringify(names), "utf-8");
}

function stripFrontmatter(text: string): string {
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

function extractDescription(path: string): string {
  try {
    const content = readFileSync(path, "utf-8");
    const lines = content.split("\n");
    if (lines[0]?.trim() !== "---") return "";
    for (const line of lines.slice(1)) {
      if (line.trim() === "---") break;
      if (line.trim().startsWith("description:")) {
        return line.split(":", 2)[1]?.trim() ?? "";
      }
    }
  } catch {
    /* ignore */
  }
  return "";
}

export function createSkill(name: string, description: string, content: string): string {
  ensureSkillsDir();
  const path = skillPath(name);
  if (existsSync(path)) {
    return `❌ 技能 '${name}' 已存在。用不同的名字，或先删除再重建。`;
  }
  const skillText = SKILL_TEMPLATE(name, description, nowDate(), content.trim());
  writeFileSync(path, skillText, "utf-8");
  return `✅ 技能 '${name}' 已创建。`;
}

export function loadSkill(name: string): string {
  const path = skillPath(name);
  if (!existsSync(path)) {
    return `⚠️ 技能 '${name}' 不存在。`;
  }
  const content = readFileSync(path, "utf-8");
  const active = getActive();
  if (!active.includes(name)) {
    active.push(name);
    saveActive(active);
  }
  const body = stripFrontmatter(content);
  return `✅ 技能 '${name}' 已加载。\n\n${body}`;
}

export function unloadSkill(name: string): string {
  const active = getActive();
  if (active.includes(name)) {
    saveActive(active.filter((n) => n !== name));
    return `🔌 技能 '${name}' 已卸载。`;
  }
  return `ℹ️ 技能 '${name}' 不在活跃列表中。`;
}

export function listSkills(): string {
  ensureSkillsDir();
  const files = readdirSync(SKILLS_DIR())
    .filter((f) => f.endsWith(".md"))
    .toSorted();
  if (!files.length) return "📭 还没有创建任何技能。";

  const active = getActive();
  const lines = ["**可用技能：**"];
  for (const f of files) {
    const name = f.replace(/\.md$/, "");
    const desc = extractDescription(join(SKILLS_DIR(), f));
    const status = active.includes(name) ? " ✅" : "";
    lines.push(`  • \`${name}\`${status} — ${desc || "(无描述)"}`);
  }
  return lines.join("\n");
}

export function viewSkill(name: string): string {
  const path = skillPath(name);
  if (!existsSync(path)) return `⚠️ 技能 '${name}' 不存在。`;
  return readFileSync(path, "utf-8").trim();
}

export function deleteSkill(name: string): string {
  const path = skillPath(name);
  if (!existsSync(path)) return `⚠️ 技能 '${name}' 不存在。`;
  unlinkSync(path);
  const active = getActive();
  if (active.includes(name)) {
    saveActive(active.filter((n) => n !== name));
  }
  return `🗑️ 技能 '${name}' 已删除。`;
}

export function getActiveSkillsContent(maxSkills = 5): string {
  const names = getActive().slice(0, maxSkills);
  if (!names.length) return "";

  const parts: string[] = [];
  for (const name of names) {
    const path = skillPath(name);
    if (!existsSync(path)) continue;
    const body = stripFrontmatter(readFileSync(path, "utf-8"));
    if (body.trim()) {
      parts.push(`<skill name="${name}">\n${body.trim()}\n</skill>`);
    }
  }
  if (!parts.length) return "";
  return `\n\n--- 已加载的技能 ---\n${parts.join("\n\n")}`;
}
