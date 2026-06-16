import { z } from "zod";
import { broadcastPetEvent, type EmotionKind } from "../pet-state.ts";

const petSaySchema = z.object({
  text: z.string().min(1),
  duration_ms: z.number().int().positive().optional(),
});

const petEmoteSchema = z.object({
  emotion: z.enum(["neutral", "joy", "angry", "sad", "surprised", "think", "talk"]),
  weight: z.number().min(0).max(1).optional(),
});

const petMoveSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export async function executePetTool(
  localName: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (localName) {
    case "pet_say": {
      const parsed = petSaySchema.parse(args);
      broadcastPetEvent({
        type: "say",
        text: parsed.text,
        duration_ms: parsed.duration_ms,
      });
      return JSON.stringify({ ok: true, text: parsed.text });
    }
    case "pet_emote": {
      const parsed = petEmoteSchema.parse(args);
      broadcastPetEvent({
        type: "emote",
        emotion: parsed.emotion as EmotionKind,
        weight: parsed.weight,
      });
      return JSON.stringify({ ok: true, emotion: parsed.emotion });
    }
    case "pet_move": {
      const parsed = petMoveSchema.parse(args);
      broadcastPetEvent({ type: "move", x: parsed.x, y: parsed.y });
      return JSON.stringify({ ok: true, x: parsed.x, y: parsed.y });
    }
    default:
      throw new Error(`unknown pet tool: ${localName}`);
  }
}
