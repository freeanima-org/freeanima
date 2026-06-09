import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { logComponent } from "@freeanima/service-logging";

const TOOLSET_REF_RE = /^@(.+)$/;

/** `@ToolSetName` → ToolSetRegistry 中的工具名；未识别则 warning 并保留原样 */
export function expandToolSets(items: string[], toolSetRegistry: ToolSetRegistry): string[] {
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
    const toolSet = toolSetRegistry.get(toolSetName);
    if (!toolSet) {
      logComponent("mask").warn(`Unknown ToolSet '${toolSetName}' in mask; keeping '${item}'`, {
        tool_set: toolSetName,
      });
      out.push(item);
      continue;
    }
    out.push(...toolSet.tools.map((t) => t.name));
  }
  return out;
}
