import { expandToolNames as expandFromEngine } from "@freeanima/host/core/tool";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { logCapability as logComponent } from "@freeanima/host/core/config/capability-injection";

/** `@ToolSetName` → ToolSetRegistry 中的工具名；未知 ToolSet 告警并保留字面量 */
export function expandToolSets(
  items: readonly string[],
  toolSetRegistry: ToolSetRegistry,
): string[] {
  return expandFromEngine(toolSetRegistry, [...items], {
    onUnknownToolSet: (toolSetName) => {
      logComponent("capability-policy").warn(`Unknown ToolSet '${toolSetName}' in policy`, {
        tool_set: toolSetName,
      });
    },
  });
}
