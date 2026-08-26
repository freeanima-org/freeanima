/**
 * SSH / 远端 probe：经 Habitat coding.outpostExec 的 WorkspaceFsBackend。
 */

import {
  createOutpostWorkspaceBackend,
  type WorkspaceFsBackend,
} from "@freeanima/shared/coding/outpost";
import type { CodingOutpostExecTool } from "@freeanima/shared/rpc-contract/frames/coding.ts";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

export function createHabitatOutpostWorkspaceBackend(opts: {
  instanceId: string;
  workspaceRoot: string;
  conversationId?: string | null;
}): WorkspaceFsBackend {
  const client = getTypedHabitatClient();
  return createOutpostWorkspaceBackend({
    workspaceRoot: opts.workspaceRoot,
    exec: async (tool: CodingOutpostExecTool, args) => {
      const out = await client.call("coding.outpostExec", {
        instance_id: opts.instanceId,
        tool,
        args,
        workspace_root: opts.workspaceRoot,
        ...(opts.conversationId ? { conversation_id: opts.conversationId } : {}),
      });
      return out.content;
    },
  });
}
