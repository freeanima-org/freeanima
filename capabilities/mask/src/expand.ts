import { expandToolNames as expandFromEngine } from "@freeanima/engine-tool";
import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { logComponent } from "@freeanima/service-logging";

/** `@ToolSetName` → ToolSetRegistry 中的工具名；未识别则 warning 并保留原样 */
export function expandToolSets(items: string[], toolSetRegistry: ToolSetRegistry): string[] {
  return expandFromEngine(toolSetRegistry, items, {
    onUnknownToolSet: (toolSetName) => {
      logComponent("mask").warn(`Unknown ToolSet '${toolSetName}' in mask`, {
        tool_set: toolSetName,
      });
    },
  });
}
