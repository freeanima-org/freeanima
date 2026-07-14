import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/core/db/pg/entity";
import { toolError } from "@freeanima/core/tool";

function parseWorldId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

export const WORLD_ID_TOOL_PROPERTY = {
  type: "integer",
  description: "Owning world id (see system prompt: user_world_id / agent_world_id)",
} as const;

export const WORLD_ID_OPTIONAL = {
  world_id: {
    ...WORLD_ID_TOOL_PROPERTY,
    description:
      "Optional world override; defaults to caller subject private world (MCP token subject or agent subject for LLM)",
  },
} as const;

export async function resolveEmailToolWorld(opts: {
  args: Record<string, unknown>;
  entityId?: number;
  accountId?: number;
  access?: "read" | "write";
}): Promise<number | string> {
  try {
    const explicit = parseWorldId(opts.args.world_id);
    const entityId =
      opts.entityId ?? (opts.accountId != null && opts.accountId > 0 ? opts.accountId : undefined);
    return await resolveToolWorld({
      ...(explicit != null ? { explicitWorldId: explicit } : {}),
      ...(entityId != null ? { entityId } : {}),
      access: opts.access ?? "read",
    });
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}
