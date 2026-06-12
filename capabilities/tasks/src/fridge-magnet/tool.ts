import { getToolSessionId } from "@freeanima/core/tool";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolResult, toolError, type ToolArgs } from "@freeanima/core/tool";
import { FRIDGE_TOOL_RETURNS } from "./return-schemas.ts";
import { clampTtl, magnetRedisKey, randomBase62, setMagnet } from "./store.ts";

export function registerWriteFridgeMagnetTool(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "fridge-magnet",
    "Cross-turn fridge magnet notes",
    attachToolReturns(
      [
        {
          name: "fridge_magnet_write",
          description:
            "Write a note on the fridge magnet board. The fridge magnet board is a temporary cross-turn shared state blackboard attached to the current session with an expiry time. key is optional; if omitted a 4-character random ID is generated.",
          parameters: {
            type: "object",
            properties: {
              key: {
                type: "string",
                description: "Note name (optional), e.g. user_mood; auto-generated if omitted",
              },
              value: { type: "string", description: "Note content" },
              ttl_seconds: {
                type: "number",
                description: "Expiry time in seconds, default 86400 (24 hours), max 86400",
              },
            },
            required: ["value"],
          },
          handler: async (args: ToolArgs) => {
            const sessionId = getToolSessionId();
            if (!sessionId) return toolError("Unable to get current session ID");
            const value = String(args.value ?? "").trim();
            if (!value) return toolError("value cannot be empty");
            const label = String(args.key ?? "").trim() || randomBase62(4);
            const ttl = clampTtl(args.ttl_seconds as number | undefined);
            const magnetId = `${sessionId}:${label}`;
            await setMagnet("session", magnetId, value, ttl);
            return toolResult({
              ok: true,
              redis_key: magnetRedisKey("session", magnetId),
              label,
              ttl,
            });
          },
        },
      ],
      FRIDGE_TOOL_RETURNS,
    ),
  );
}
