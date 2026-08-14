import { resolveSubjectWorldId } from "@freeanima/habitat/core/config";
import type { NoteSubjectKind } from "./types.ts";

export async function resolveNoteWorldId(kind: NoteSubjectKind): Promise<number> {
  return resolveSubjectWorldId(kind);
}
