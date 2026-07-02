import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/core/db/pg/entity";
import { toolError } from "@freeanima/core/tool";

import { parseWorldId } from "./task-tool-helpers.ts";

export async function resolveTaskToolWorld(opts: {
  args: Record<string, unknown>;
  entityId?: number;
  listId?: number;
}): Promise<number | string> {
  try {
    const explicit = parseWorldId(opts.args.world_id);
    return await resolveToolWorld({
      ...(explicit != null ? { explicitWorldId: explicit } : {}),
      ...(opts.entityId != null ? { entityId: opts.entityId } : {}),
      ...(opts.listId != null ? { listId: opts.listId } : {}),
    });
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}
