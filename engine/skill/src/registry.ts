import { readdirSync } from "node:fs";
import { readSkillDescriptionFromFile } from "./content.ts";

export type SkillDef = {
  name: string;
  description: string;
  /** 技能文件所在目录（文件名为 `{name}.md`） */
  directory: string;
  /** 注册来源，如 user / acp:cursor */
  source?: string;
};

export class SkillRegistry {
  private readonly registry = new Map<string, SkillDef>();
  private readonly order: string[] = [];

  register(def: SkillDef): void {
    if (!this.registry.has(def.name)) this.order.push(def.name);
    this.registry.set(def.name, def);
  }

  unregister(name: string): boolean {
    if (!this.registry.has(name)) return false;
    this.registry.delete(name);
    const idx = this.order.indexOf(name);
    if (idx >= 0) this.order.splice(idx, 1);
    return true;
  }

  unregisterBySource(source: string): string[] {
    const removed: string[] = [];
    for (const def of this.list()) {
      if (def.source === source) {
        this.unregister(def.name);
        removed.push(def.name);
      }
    }
    return removed;
  }

  get(name: string): SkillDef | undefined {
    return this.registry.get(name);
  }

  list(): SkillDef[] {
    return this.order.map((n) => this.registry.get(n)!).filter(Boolean);
  }

  search(query: string): SkillDef[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.list();
    return this.list().filter((s) => {
      const hay = `${s.name} ${s.description} ${s.source ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }
}

/** 扫描目录下 `*.md` 并注册（description 优先 frontmatter，否则用注册时传入的默认值） */
export function registerSkillsFromDirectory(
  skills: SkillRegistry,
  directory: string,
  opts?: { source?: string; description?: string },
): number {
  let files: string[];
  try {
    files = readdirSync(directory).filter((f) => f.endsWith(".md"));
  } catch {
    return 0;
  }
  let count = 0;
  for (const file of files) {
    const name = file.replace(/\.md$/, "");
    if (!name) continue;
    const description = readSkillDescriptionFromFile(directory, name) || opts?.description || "";
    skills.register({
      name,
      description,
      directory,
      source: opts?.source,
    });
    count += 1;
  }
  return count;
}
