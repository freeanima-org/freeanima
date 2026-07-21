import type { MotionSlotId } from "../../shared/companion-schema.ts";
import { MOTION_SLOT_IDS } from "../../shared/companion-schema.ts";
import { enqueueBubble, enqueuePlaySlot } from "./runtime-local.ts";

function toolResult(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function toolError(message: string): string {
  return JSON.stringify({ error: message });
}

export async function executeCompanionTool(
  localName: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (localName) {
    case "bubble": {
      const text = typeof args.text === "string" ? args.text : "";
      if (!text.trim()) {
        return toolError("text 不能为空");
      }
      const item = enqueueBubble(text);
      return toolResult({ ok: true, id: item.id, pending: item.text });
    }
    case "play_slot": {
      const slot = typeof args.slot === "string" ? args.slot : "";
      if (!MOTION_SLOT_IDS.includes(slot as MotionSlotId)) {
        return toolError(`未知动作槽位: ${slot}`);
      }
      const motionId = typeof args.motion_id === "string" ? args.motion_id : undefined;
      const cmd = enqueuePlaySlot(slot, motionId);
      return toolResult({ ok: true, id: cmd.id, slot: cmd.slot, motion_id: cmd.motionId ?? null });
    }
    default:
      return toolError(`未知工具: ${localName}`);
  }
}
