import { resolve } from "node:path";

import {
  discoverProjectAgentContext,
  type ProjectAgentContextSnapshot,
} from "@freeanima/shared/coding/project-agent-context";
import {
  WorkspaceSandbox,
  createNodeWorkspaceBackend,
  projectVfsFromSandbox,
} from "@freeanima/shared/coding/outpost";
import type { RpcClient } from "@freeanima/shared/habitat-rpc";

/** 本机 workspace 发现 AGENTS.md / rules（与 GUI project-context 同契约） */
export async function discoverLocalProjectContext(
  workspaceRoot: string,
): Promise<ProjectAgentContextSnapshot> {
  const root = resolve(workspaceRoot);
  const sandbox = new WorkspaceSandbox(root, createNodeWorkspaceBackend());
  const vfs = projectVfsFromSandbox(sandbox);
  const ctx = await discoverProjectAgentContext(vfs);
  return {
    ...ctx,
    discovered_at: new Date().toISOString(),
    workspace_root: root,
  };
}

/** 经 Habitat RPC/WS 写入会话级 project context 缓存 */
export async function syncProjectContextToHabitatRpc(
  rpc: RpcClient,
  opts: { conversationId: string; snapshot: ProjectAgentContextSnapshot },
): Promise<void> {
  await rpc.request("coding.projectContextSync", {
    conversation_id: opts.conversationId,
    snapshot: opts.snapshot,
  });
}
