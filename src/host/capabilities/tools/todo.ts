import { getToolConversationId } from "@freeanima/host/core/tool";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { attachToolReturns, toolError } from "@freeanima/host/core/tool";
import { omitUndefined } from "@freeanima/host/core/util";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import { handleConversationTodo } from "@freeanima/host/core/tool";

async function handleTodo(args: Record<string, unknown>): Promise<string> {
  const conversationId = getToolConversationId();
  if (!conversationId) return toolError("No conversation context");

  const action = String(args.action ?? "list");
  const content = args.content != null ? String(args.content) : undefined;
  const id = typeof args.id === "number" ? args.id : args.id != null ? Number(args.id) : undefined;
  const status = args.status != null ? String(args.status) : undefined;

  return handleConversationTodo(conversationId, action, omitUndefined({ content, id, status }));
}

export function registerTodoTool(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "todo",
    "Current conversation todo list",
    attachToolReturns(
      [
        {
          name: "todo",
          description:
            "Manage the todo list for the current conversation conversation (isolated from other sessions). Supports list/add/update/delete",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["list", "add", "update", "delete"],
                description:
                  "list — list; add — add (requires content); update — update status (requires id+status); delete — delete (requires id)",
              },
              content: { type: "string", description: "Todo content (required for add)" },
              id: { type: "integer", description: "Todo ID (required for update/delete)" },
              status: {
                type: "string",
                enum: ["pending", "in_progress", "completed", "cancelled"],
                description: "New status (required for update)",
              },
            },
            required: ["action"],
          },
          handler: handleTodo,
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
