import type { ToolSetRegistry } from "./toolset.ts";

const TOOLSET_REF_RE = /^@(.+)$/;

export type ExpandToolNamesOptions = {
  /** Keep unknown @toolset as-is; default true */
  keepUnknownRefs?: boolean;
  onUnknownToolSet?: (toolSetName: string, raw: string) => void;
};

/** `@ToolSetName` → tool names in ToolSetRegistry */
export function expandToolNames(
  registry: ToolSetRegistry,
  items: string[],
  opts?: ExpandToolNamesOptions,
): string[] {
  const keepUnknown = opts?.keepUnknownRefs !== false;
  const out: string[] = [];
  for (const raw of items) {
    const item = raw.trim();
    if (!item) continue;
    const match = TOOLSET_REF_RE.exec(item);
    if (!match) {
      out.push(item);
      continue;
    }
    const toolSetName = match[1]!.trim();
    const toolSet = registry.getToolSet(toolSetName);
    if (!toolSet) {
      opts?.onUnknownToolSet?.(toolSetName, item);
      if (keepUnknown) out.push(item);
      continue;
    }
    out.push(...toolSet.tools.map((t) => t.name));
  }
  return out;
}
