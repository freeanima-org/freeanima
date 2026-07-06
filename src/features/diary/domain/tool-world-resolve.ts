import { resolveToolWorld, ToolWorldAccessError } from "@freeanima/core/db/pg/entity";
import { toolError } from "@freeanima/core/tool";

export function parseWorldId(raw: unknown): number | null {
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

export async function resolveDiaryToolWorld(
  args: Record<string, unknown>,
): Promise<number | string> {
  try {
    const explicit = parseWorldId(args.world_id);
    return await resolveToolWorld(explicit != null ? { explicitWorldId: explicit } : {});
  } catch (e) {
    const msg = e instanceof ToolWorldAccessError ? e.message : String(e);
    return toolError(msg);
  }
}
