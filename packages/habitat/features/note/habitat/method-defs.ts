import {
  noteAppendInputSchema,
  noteAppendOutputSchema,
  noteBlockCreateInputSchema,
  noteBlockCreateOutputSchema,
  noteBlockDeleteInputSchema,
  noteBlockDeleteOutputSchema,
  noteBlockPatchInputSchema,
  noteBlockPatchOutputSchema,
  noteBlockReorderInputSchema,
  noteBlockReorderOutputSchema,
  noteCreateInputSchema,
  noteCreateOutputSchema,
  noteDeleteInputSchema,
  noteDeleteOutputSchema,
  noteGetInputSchema,
  noteGetOutputSchema,
  noteListInputSchema,
  noteListOutputSchema,
  notePatchInputSchema,
  notePatchOutputSchema,
  noteSearchInputSchema,
  noteSearchOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/note";

import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";

export const noteMethodDefs = {
  "note.list": defineHabitatMethod({
    input: noteListInputSchema,
    output: noteListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "note.create": defineHabitatMethod({
    input: noteCreateInputSchema,
    output: noteCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "note.append": defineHabitatMethod({
    input: noteAppendInputSchema,
    output: noteAppendOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "note.patch": defineHabitatMethod({
    input: notePatchInputSchema,
    output: notePatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "note.delete": defineHabitatMethod({
    input: noteDeleteInputSchema,
    output: noteDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "note.get": defineHabitatMethod({
    input: noteGetInputSchema,
    output: noteGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "note.search": defineHabitatMethod({
    input: noteSearchInputSchema,
    output: noteSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "note.blockCreate": defineHabitatMethod({
    input: noteBlockCreateInputSchema,
    output: noteBlockCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "note.blockPatch": defineHabitatMethod({
    input: noteBlockPatchInputSchema,
    output: noteBlockPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "note.blockDelete": defineHabitatMethod({
    input: noteBlockDeleteInputSchema,
    output: noteBlockDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "note.blockReorder": defineHabitatMethod({
    input: noteBlockReorderInputSchema,
    output: noteBlockReorderOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;
