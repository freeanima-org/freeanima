/**
 * Coding Outpost：发现项目 Agent 上下文并（可选）同步到 Habitat。
 */

import {
  discoverProjectAgentContext,
  type ProjectAgentContextSnapshot,
} from "@freeanima/features/coding/domain";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import { projectVfsFromSandbox } from "./workspace-vfs.ts";
import type { WorkspaceSandbox } from "./workspace-fs.ts";

export async function discoverWorkspaceProjectContext(
  sandbox: WorkspaceSandbox,
): Promise<ProjectAgentContextSnapshot> {
  const vfs = projectVfsFromSandbox(sandbox);
  const ctx = await discoverProjectAgentContext(vfs);
  return {
    ...ctx,
    discovered_at: new Date().toISOString(),
    workspace_root: sandbox.workspaceRoot,
  };
}

export async function syncProjectContextToHabitat(opts: {
  conversationId: string;
  snapshot: ProjectAgentContextSnapshot;
}): Promise<void> {
  const token = window.portalShell?.remoteAuth?.token?.trim();
  if (!token) return;
  const client = getTypedHabitatClient();
  await client.call("coding.projectContextSync", {
    conversation_id: opts.conversationId,
    snapshot: opts.snapshot,
  });
}
