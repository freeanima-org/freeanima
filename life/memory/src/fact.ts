import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  factDataSchema,
  safeParseOrNull,
  type FactData,
  type FactSource,
  type FactType,
} from "@freeanima/kernel-schemas";

export const FRONTMATTER_DELIM = "---";

export type { FactType, FactSource, FactData };

export function nowIso(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace("Z", "+08:00");
}

export function factScore(f: FactData): number {
  return f.confidence * f.importance * f.recall;
}

export function splitFrontmatter(text: string): [string | null, string] {
  const lines = text.split("\n");
  if (!lines.length || lines[0]!.trim() !== FRONTMATTER_DELIM) return [null, text];
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === FRONTMATTER_DELIM) {
      end = i;
      break;
    }
  }
  if (end <= 1) return [null, text];
  const front = lines.slice(1, end).join("\n");
  const body = lines.slice(end + 1).join("\n");
  return [front, body];
}

export function parseFact(text: string): FactData | null {
  const [front, body] = splitFrontmatter(text);
  if (front === null) return null;
  let data: unknown;
  try {
    data = parseYaml(front);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const now = nowIso();
  const parsed = safeParseOrNull(factDataSchema, {
    ...d,
    created: d.created ?? now,
    updated: d.updated ?? d.created ?? now,
    content: body.trim(),
  });
  return parsed;
}

export function factToFileText(f: FactData): string {
  const { content, ...rest } = f;
  const front = stringifyYaml(rest).trim();
  const parts = [FRONTMATTER_DELIM, front, FRONTMATTER_DELIM];
  if (content) {
    parts.push("", content.trim());
  }
  return `${parts.join("\n")}\n`;
}

export function createFact(partial: Partial<FactData> & { content: string }): FactData {
  const now = nowIso();
  return {
    id: partial.id ?? "",
    type: partial.type ?? "fact",
    confidence: partial.confidence ?? 0.6,
    importance: partial.importance ?? 0.5,
    recall: partial.recall ?? 0.5,
    domains: partial.domains ?? [],
    threads: partial.threads ?? [],
    entities: partial.entities ?? [],
    sources: partial.sources ?? [],
    created: partial.created ?? now,
    updated: partial.updated ?? now,
    content: partial.content,
  };
}
