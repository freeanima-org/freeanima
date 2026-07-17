import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/core/db/pg/entity";
import { toolError } from "@freeanima/core/tool";

import { parseWorldId } from "./block-tool-helpers.ts";

export async function resolveContentBlockToolWorld(opts: {
  args: Record<string, unknown>;
  entityId?: number;
  access?: "read" | "write";
}): Promise<number | string> {
  try {
    const explicit = parseWorldId(opts.args.world_id);
    return await resolveToolWorld({
      ...(explicit != null ? { explicitWorldId: explicit } : {}),
      ...(opts.entityId != null ? { entityId: opts.entityId } : {}),
      access: opts.access ?? "read",
    });
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}
