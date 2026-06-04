import { getToolSessionId } from "@freeanima/legacy-engine";
import { registerTool, toolError } from "@freeanima/legacy-kernel";
import { handleSessionTodo } from "@freeanima/legacy-runtime";

async function handleTodo(args: Record<string, unknown>): Promise<string> {
  const sessionId = getToolSessionId();
  if (!sessionId) return toolError("无 session 上下文");

  const action = String(args.action ?? "list");
  const content = args.content != null ? String(args.content) : undefined;
  const id = typeof args.id === "number" ? args.id : args.id != null ? Number(args.id) : undefined;
  const status = args.status != null ? String(args.status) : undefined;

  return handleSessionTodo(sessionId, action, { content, id, status });
}

export function registerTodoTool(): void {
  registerTool({
    name: "todo",
    description:
      "管理当前对话 session 的待办清单（与其他 session 隔离）。支持 list/add/update/delete",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "add", "update", "delete"],
          description:
            "list — 列出；add — 添加（需 content）；update — 更新状态（需 id+status）；delete — 删除（需 id）",
        },
        content: { type: "string", description: "待办内容（add 必需）" },
        id: { type: "integer", description: "待办 ID（update/delete 必需）" },
        status: {
          type: "string",
          enum: ["pending", "in_progress", "completed", "cancelled"],
          description: "新状态（update 必需）",
        },
      },
      required: ["action"],
    },
    handler: handleTodo,
  });
}
