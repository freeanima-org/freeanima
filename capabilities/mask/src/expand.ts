import { expandToolNames as expandFromEngine } from "@freeanima/mechanism-tool";
import type { ToolSetRegistry } from "@freeanima/mechanism-tool";
import { logCapability as logComponent } from "@freeanima/storage-config";

/** `@ToolSetName` → tool names in ToolSetRegistry; warning and keep as-is if unrecognized */
export function expandToolSets(items: string[], toolSetRegistry: ToolSetRegistry): string[] {
  return expandFromEngine(toolSetRegistry, items, {
    onUnknownToolSet: (toolSetName) => {
      logComponent("mask").warn(`Unknown ToolSet '${toolSetName}' in mask`, {
        tool_set: toolSetName,
      });
    },
  });
}
