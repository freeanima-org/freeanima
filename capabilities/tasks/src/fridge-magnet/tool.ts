import { getToolConversationId } from "@freeanima/core/tool";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolResult, toolError, type ToolArgs } from "@freeanima/core/tool";
import { FRIDGE_TOOL_RETURNS } from "./return-schemas.ts";
import { clampTtl, deleteMagnet, magnetRedisKey, randomBase62, setMagnet } from "./store.ts";

const FRIDGE_MODULES = new Set(["conversation", "dream", "tasks"]);

export function registerWriteFridgeMagnetTool(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "fridge-magnet",
    "Cross-turn fridge magnet notes",
    attachToolReturns(
      [
        {
          name: "fridge_magnet_write",
          description:
            "Write a note on the fridge magnet board. The fridge magnet board is a temporary cross-turn shared state blackboard attached to the current conversation with an expiry time. key is optional; if omitted a 4-character random ID is generated.",
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
            const conversationId = getToolConversationId();
            if (!conversationId) return toolError("Unable to get current conversation ID");
            const value = String(args.value ?? "").trim();
            if (!value) return toolError("value cannot be empty");
            const label = String(args.key ?? "").trim() || randomBase62(4);
            const ttl = clampTtl(args.ttl_seconds as number | undefined);
            const magnetId = `${conversationId}:${label}`;
            await setMagnet("conversation", magnetId, value, ttl);
            return toolResult({
              ok: true,
              redis_key: magnetRedisKey("conversation", magnetId),
              label,
              ttl,
            });
          },
        },
        {
          name: "fridge_magnet_dismiss",
          description:
            "Dismiss (tear off) a fridge magnet note. For conversation notes, key may be label only (current conversation is implied) or full conversationId:label.",
          parameters: {
            type: "object",
            properties: {
              module: {
                type: "string",
                description: "Magnet module: conversation, dream, or tasks",
                enum: ["conversation", "dream", "tasks"],
              },
              key: {
                type: "string",
                description:
                  "Magnet id within module, e.g. reminder:2026-06-14 for dream, or label for session",
              },
            },
            required: ["module", "key"],
          },
          handler: async (args: ToolArgs) => {
            const module = String(args.module ?? "").trim();
            if (!FRIDGE_MODULES.has(module)) {
              return toolError("module must be conversation, dream, or tasks");
            }
            let key = String(args.key ?? "").trim();
            if (!key) return toolError("key is required");

            if (module === "conversation") {
              const conversationId = getToolConversationId();
              if (!conversationId) return toolError("Unable to get current conversation ID");
              if (!key.includes(":")) {
                key = `${conversationId}:${key}`;
              }
            }

            await deleteMagnet(module, key);
            return toolResult({
              ok: true,
              dismissed: magnetRedisKey(module, key),
            });
          },
        },
      ],
      FRIDGE_TOOL_RETURNS,
    ),
  );
}
