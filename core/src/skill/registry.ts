import { omitUndefined } from "@freeanima/core/util";
import { readdirSync } from "node:fs";
import { readSkillDescriptionFromFile } from "./content.ts";

export type SkillDef = {
  name: string;
  description: string;
  /** Skill file directory (filename `{name}.md`) */
  directory: string;
  /** Registration source, e.g. user / acp:cursor */
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

/** Scan `*.md` in directory and register (description from frontmatter, else default at register time) */
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
    skills.register(
      omitUndefined({
        name,
        description,
        directory,
        source: opts?.source,
      }),
    );
    count += 1;
  }
  return count;
}
