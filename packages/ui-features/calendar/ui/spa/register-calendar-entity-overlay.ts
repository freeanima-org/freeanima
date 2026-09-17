import { registerEntityOverlay } from "@freeanima/portal-sdk/entity-overlay-registry.ts";

import { CalendarEventEntityOverlay } from "./CalendarEventEntityOverlay.tsx";

export function registerCalendarEventEntityOverlay(): void {
  registerEntityOverlay("calendar_event", CalendarEventEntityOverlay);
}
