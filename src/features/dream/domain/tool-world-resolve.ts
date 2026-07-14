import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/core/db/pg/entity";
import { toolError } from "@freeanima/core/tool";

function parseWorldId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

export const WORLD_ID_OPTIONAL = {
  world_id: {
    type: "integer",
    description:
      "Optional world override; defaults to caller subject private world (see system prompt: user_world_id / agent_world_id)",
  },
} as const;

export async function resolveDreamToolWorld(
  args: Record<string, unknown>,
  access: "read" | "write" = "read",
): Promise<number | string> {
  try {
    const explicit = parseWorldId(args.world_id);
    return await resolveToolWorld({
      ...(explicit != null ? { explicitWorldId: explicit } : {}),
      access,
    });
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}
