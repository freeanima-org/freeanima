import { resolveSubjectWorldId } from "@freeanima/host/core/config";
import type { CalendarSubjectKind } from "./types.ts";

export async function resolveCalendarWorldId(kind: CalendarSubjectKind): Promise<number> {
  return resolveSubjectWorldId(kind);
}
