import { asRecord, isRecord } from "@freeanima/shared/util";
import { parseYaml } from "../../platform/config/yaml.ts";

/** agentskills.io 兼容 frontmatter 解析（含 FreeAnima 扩展） */
export type SkillFrontmatter = {
  name?: string;
  description?: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, unknown>;
  /** 空格分隔或 YAML 数组 */
  "allowed-tools"?: string | string[];
  allowed_tools?: string | string[];
  denied_tools?: string | string[];
  origin?: string;
  status?: string;
  created?: string;
};

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function asStringOrStringArray(value: unknown): string | string[] | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return asString(value);
}

function extractFrontmatterBlock(text: string): string | null {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      return lines.slice(1, i).join("\n");
    }
  }
  return null;
}

export function parseFrontmatter(text: string): SkillFrontmatter {
  const block = extractFrontmatterBlock(text);
  if (block == null) return {};
  let raw: unknown;
  try {
    raw = parseYaml(block);
  } catch {
    return {};
  }
  if (!isRecord(raw)) return {};
  const obj = raw;
  const out: SkillFrontmatter = {};

  const name = asString(obj.name);
  if (name != null) out.name = name;
  const description = asString(obj.description);
  if (description != null) out.description = description;
  const license = asString(obj.license);
  if (license != null) out.license = license;
  const compatibility = asString(obj.compatibility);
  if (compatibility != null) out.compatibility = compatibility;
  const created = asString(obj.created);
  if (created != null) out.created = created;
  const origin = asString(obj.origin);
  if (origin != null) out.origin = origin;
  const status = asString(obj.status);
  if (status != null) out.status = status;

  const metadata = asRecord(obj.metadata);
  if (metadata) {
    out.metadata = metadata;
  }

  const allowedDash = asStringOrStringArray(obj["allowed-tools"]);
  if (allowedDash != null) out["allowed-tools"] = allowedDash;
  const allowedSnake = asStringOrStringArray(obj.allowed_tools);
  if (allowedSnake != null) out.allowed_tools = allowedSnake;

  const denied =
    asStringOrStringArray(obj.denied_tools) ?? asStringOrStringArray(obj["denied-tools"]);
  if (denied != null) out.denied_tools = denied;

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

export function normalizeToolList(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((s) => s.trim()).filter(Boolean);
  return value
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function serializeSkillMarkdown(input: {
  name: string;
  description: string;
  content: string;
  license?: string;
  compatibility?: string;
  allowed_tools?: readonly string[];
  denied_tools?: readonly string[];
  origin?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}): string {
  const lines: string[] = ["---", `name: ${input.name}`, `description: ${input.description}`];
  if (input.license) lines.push(`license: ${input.license}`);
  if (input.compatibility) lines.push(`compatibility: ${input.compatibility}`);
  if (input.allowed_tools && input.allowed_tools.length > 0) {
    lines.push(`allowed-tools: ${input.allowed_tools.join(" ")}`);
  }
  if (input.denied_tools && input.denied_tools.length > 0) {
    lines.push(`denied_tools: [${input.denied_tools.map((t) => JSON.stringify(t)).join(", ")}]`);
  }
  if (input.origin) lines.push(`origin: ${input.origin}`);
  if (input.status) lines.push(`status: ${input.status}`);
  const meta = { ...input.metadata };
  if (input.origin) meta["freeanima.origin"] = input.origin;
  if (input.status) meta["freeanima.status"] = input.status;
  if (input.denied_tools && input.denied_tools.length > 0) {
    meta["freeanima.denied_tools"] = input.denied_tools;
  }
  if (Object.keys(meta).length > 0) {
    lines.push("metadata:");
    for (const [k, v] of Object.entries(meta)) {
      lines.push(`  ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
  }
  lines.push("---", "", input.content.trim(), "");
  return lines.join("\n");
}
