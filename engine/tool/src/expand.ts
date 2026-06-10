import type { ToolSetRegistry } from "./toolset.ts";

const TOOLSET_REF_RE = /^@(.+)$/;

export type ExpandToolNamesOptions = {
  /** 未知 @toolset 时保留原样；默认 true */
  keepUnknownRefs?: boolean;
  onUnknownToolSet?: (toolSetName: string, raw: string) => void;
};

/** `@ToolSetName` → ToolSetRegistry 中的工具名 */
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
