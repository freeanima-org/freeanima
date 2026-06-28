import { deleteMagnet, setMagnet } from "@freeanima/capabilities-task/fridge-magnet";
import type { DreamFridgePort } from "@freeanima/capabilities-memory/dream/run";

const DREAM_REMINDER_TTL = 86400;

/** Composition-root factory: dream fridge reminders via Redis magnets */
export function createDreamFridgePort(): DreamFridgePort {
  return {
    async setReminder(day: string, teaser: string): Promise<void> {
      await setMagnet("dream", `reminder:${day}`, teaser, DREAM_REMINDER_TTL);
    },
    async dismissReminder(day: string): Promise<void> {
      await deleteMagnet("dream", `reminder:${day}`);
    },
  };
}
