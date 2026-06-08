/**
 * 旧 Markdown 语义记忆文件解析（仅迁移脚本与一次性回填使用）。
 * 运行时代码勿依赖此模块。
 */
import { parseYaml } from "@freeanima/service-config";
import { formatCstIso, safeParseOrNull } from "@freeanima/kernel-util";
import { z } from "zod";

export const FRONTMATTER_DELIM = "---";

const legacyFactSourceSchema = z
  .object({
    session_id: z.string().optional(),
    message_id: z.number().optional(),
  })
  .passthrough();

const legacyFactDataSchema = z.object({
  id: z.string(),
  type: z.string(),
  confidence: z.number(),
  importance: z.number(),
  recall: z.number(),
  domains: z.array(z.string()).default([]),
  threads: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]),
  sources: z.array(legacyFactSourceSchema).default([]),
  created: z.string(),
  updated: z.string(),
  content: z.string(),
});

export type LegacyFactData = z.infer<typeof legacyFactDataSchema>;

function splitFrontmatter(text: string): [string | null, string] {
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

/** 解析 f-*.md 文件内容为旧 FactData 形状 */
export function parseLegacyFact(text: string): LegacyFactData | null {
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
  const now = formatCstIso();
  return safeParseOrNull(legacyFactDataSchema, {
    ...d,
    created: d.created ?? now,
    updated: d.updated ?? d.created ?? now,
    content: body.trim(),
  });
}
