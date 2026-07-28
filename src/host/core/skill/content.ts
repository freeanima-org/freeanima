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

function parseYamlScalar(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseInlineArray(value: string): string[] | undefined {
  const v = value.trim();
  if (!v.startsWith("[") || !v.endsWith("]")) return undefined;
  const inner = v.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((s) => parseYamlScalar(s.trim()))
    .filter(Boolean);
}

export function parseFrontmatter(text: string): SkillFrontmatter {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return {};
  const out: SkillFrontmatter = {};
  let i = 1;
  for (; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.trim();
    if (line === "---") break;
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const valueRaw = line.slice(idx + 1).trim();
    if (key === "metadata" && (!valueRaw || valueRaw === "{}")) {
      // 简易 metadata 块：后续行缩进 key: value
      const meta: Record<string, unknown> = {};
      let j = i + 1;
      for (; j < lines.length; j++) {
        const ml = lines[j] ?? "";
        if (!ml.startsWith(" ") && !ml.startsWith("\t")) break;
        const mtrim = ml.trim();
        if (mtrim === "---") break;
        const mi = mtrim.indexOf(":");
        if (mi <= 0) continue;
        meta[mtrim.slice(0, mi).trim()] = parseYamlScalar(mtrim.slice(mi + 1));
      }
      out.metadata = meta;
      i = j - 1;
      continue;
    }
    if (key === "name") out.name = parseYamlScalar(valueRaw);
    else if (key === "description") out.description = parseYamlScalar(valueRaw);
    else if (key === "license") out.license = parseYamlScalar(valueRaw);
    else if (key === "compatibility") out.compatibility = parseYamlScalar(valueRaw);
    else if (key === "created") out.created = parseYamlScalar(valueRaw);
    else if (key === "origin") out.origin = parseYamlScalar(valueRaw);
    else if (key === "status") out.status = parseYamlScalar(valueRaw);
    else if (key === "allowed-tools" || key === "allowed_tools") {
      const arr = parseInlineArray(valueRaw);
      const val = arr ?? parseYamlScalar(valueRaw);
      if (key === "allowed-tools") out["allowed-tools"] = val;
      else out.allowed_tools = val;
    } else if (key === "denied_tools" || key === "denied-tools") {
      const arr = parseInlineArray(valueRaw);
      out.denied_tools = arr ?? parseYamlScalar(valueRaw);
    }
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
