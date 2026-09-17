import type { CodingAgentSession } from "./agent-sessions.ts";
import { createPortalShellWorkspaceBackend } from "./workspace-fs.ts";
import { createHabitatOutpostWorkspaceBackend } from "./outpost-fs.ts";
import type { WorkspaceFsBackend } from "@freeanima/shared/coding/outpost";

/** 按会话 kind 选择本机 FS 或 Habitat outpostExec backend */
export function resolveSessionWorkspaceBackend(
  session: CodingAgentSession | null,
  opts?: { conversationId?: string | null },
): WorkspaceFsBackend | null {
  if (!session?.workspaceRoot) return null;
  if (session.workspaceKind === "ssh") {
    const instanceId = session.outpostInstanceId?.trim();
    if (!instanceId) return null;
    return createHabitatOutpostWorkspaceBackend({
      instanceId,
      workspaceRoot: session.workspaceRoot,
      conversationId: opts?.conversationId ?? session.conversationId,
    });
  }
  return createPortalShellWorkspaceBackend();
}
