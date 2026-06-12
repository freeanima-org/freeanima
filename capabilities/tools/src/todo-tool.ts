import { getToolSessionId, getToolRepos } from "@freeanima/core/tool";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError } from "@freeanima/core/tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import { handleSessionTodo } from "@freeanima/core/tool";

async function handleTodo(args: Record<string, unknown>): Promise<string> {
  const sessionId = getToolSessionId();
  if (!sessionId) return toolError("No session context");
  const repos = getToolRepos();
  if (!repos) return toolError("No repos context");

  const action = String(args.action ?? "list");
  const content = args.content != null ? String(args.content) : undefined;
  const id = typeof args.id === "number" ? args.id : args.id != null ? Number(args.id) : undefined;
  const status = args.status != null ? String(args.status) : undefined;

  return handleSessionTodo(repos, sessionId, action, { content, id, status });
}

export function registerTodoTool(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "todo",
    "Current session todo list",
    attachToolReturns(
      [
        {
          name: "todo",
          description:
            "Manage the todo list for the current conversation session (isolated from other sessions). Supports list/add/update/delete",
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
