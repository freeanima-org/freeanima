import { isPostgresPrimary } from "@freeanima/host/core/db/pg";
import { omitUndefined } from "@freeanima/host/core/util";
import type {
  CodingNoteCreateInput,
  CodingNoteListInput,
  CodingNoteRowPayload,
} from "@freeanima/shared/rpc-contract/frames/coding.ts";

import { createCodingNote, listCodingNotes, type CodingNoteRow } from "../domain/note-store.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function toPayload(row: CodingNoteRow): CodingNoteRowPayload {
  return omitUndefined({
    id: row.id,
    world_id: row.world_id,
    title: row.title,
    summary: row.summary,
    kind: row.kind,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  });
}

export async function serviceCodingNoteCreate(deps: RuntimeDeps, input: CodingNoteCreateInput) {
  assertPg(deps);
  const item = await createCodingNote(
    omitUndefined({
      world_id: input.world_id,
      title: input.title,
      summary: input.summary,
      content: input.content,
      kind: input.kind,
    }),
  );
  return { item: toPayload(item) };
}

export async function serviceCodingNoteList(deps: RuntimeDeps, input: CodingNoteListInput) {
  assertPg(deps);
  const { items, count } = await listCodingNotes(
    omitUndefined({
      world_id: input.world_id,
      limit: input.limit,
      offset: input.offset,
    }),
  );
  return { items: items.map(toPayload), count };
}
