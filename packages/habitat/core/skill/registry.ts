import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  skillBodySchema,
  type SkillBody,
  type SkillOrigin,
  type SkillStatus,
} from "@freeanima/habitat/core/db/schema/entity";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeToolList, parseFrontmatter, stripFrontmatter } from "./content.ts";

export type SkillDef = {
  name: string;
  description: string;
  entityId: number;
  worldId: number;
  tag_ids: readonly number[];
  origin: SkillOrigin;
  status: SkillStatus;
  allowed_tools: readonly string[];
  denied_tools: readonly string[];
  license?: string;
  compatibility?: string;
  metadata: Record<string, unknown>;
  content: string;
  source?: string;
};

export class SkillRegistry {
  private readonly registry = new Map<string, SkillDef>();
  private readonly order: string[] = [];

  clear(): void {
    this.registry.clear();
    this.order.length = 0;
  }

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
    return this.order
      .map((n) => this.registry.get(n))
      .filter((s): s is SkillDef => s !== undefined);
  }

  listActive(): SkillDef[] {
    return this.list().filter((s) => s.status === "active");
  }

  search(query: string): SkillDef[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.list();
    return this.list().filter((s) => {
      const hay = `${s.name} ${s.description} ${s.origin} ${s.source ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }
}

export function skillDefFromBody(
  input: {
    name: string;
    description: string;
    entityId: number;
    worldId: number;
    tag_ids?: readonly number[];
    content: string;
    source?: string;
  },
  body: SkillBody,
): SkillDef {
  return omitUndefined({
    name: input.name,
    description: input.description,
    entityId: input.entityId,
    worldId: input.worldId,
    tag_ids: input.tag_ids ?? [],
    origin: body.origin,
    status: body.status,
    allowed_tools: body.allowed_tools,
    denied_tools: body.denied_tools,
    license: body.license,
    compatibility: body.compatibility,
    metadata: body.metadata,
    content: input.content,
    source: input.source ?? body.origin,
  });
}

/** 从已读入的 markdown 注册瞬时技能（entityId/worldId = 0，非 DB SSOT）。 */
export function registerSkillFromMarkdown(
  skills: SkillRegistry,
  raw: string,
  opts?: { source?: string; fallbackName?: string },
): boolean {
  const fm = parseFrontmatter(raw);
  const name = (fm.name ?? opts?.fallbackName ?? "").trim();
  if (!name) return false;
  const body = skillBodySchema.parse({
    origin: "builtin",
    status: "active",
    license: fm.license,
    compatibility: fm.compatibility,
    metadata: fm.metadata ?? {},
    allowed_tools: normalizeToolList(fm["allowed-tools"] ?? fm.allowed_tools),
    denied_tools: normalizeToolList(fm.denied_tools),
  });
  skills.register(
    skillDefFromBody(
      omitUndefined({
        name,
        description: (fm.description ?? "").trim(),
        entityId: 0,
        worldId: 0,
        content: stripFrontmatter(raw),
        source: opts?.source,
      }),
      body,
    ),
  );
  return true;
}

/**
 * 从目录扫描 *.md 注册到内存 registry（开发态磁盘扫描；standalone 请用 type:text 嵌入）。
 * entityId/worldId = 0 表示未入库。
 */
export function registerSkillsFromDirectory(
  skills: SkillRegistry,
  directory: string,
  opts?: { source?: string },
): number {
  if (!existsSync(directory)) return 0;
  let files: string[];
  try {
    files = readdirSync(directory).filter((f) => f.endsWith(".md"));
  } catch {
    return 0;
  }
  let count = 0;
  for (const file of files) {
    const nameFromFile = file.replace(/\.md$/, "");
    if (!nameFromFile) continue;
    let raw: string;
    try {
      raw = readFileSync(join(directory, file), "utf-8");
    } catch {
      continue;
    }
    if (
      registerSkillFromMarkdown(
        skills,
        raw,
        omitUndefined({ source: opts?.source, fallbackName: nameFromFile }),
      )
    ) {
      count += 1;
    }
  }
  return count;
}
