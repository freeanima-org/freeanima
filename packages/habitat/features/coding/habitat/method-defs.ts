import {
  defineHabitatMethod,
  dualTransportMeta,
  longOpMeta,
} from "@freeanima/shared/habitat-contract";
import {
  codingNoteCreateInputSchema,
  codingNoteCreateOutputSchema,
  codingNoteListInputSchema,
  codingNoteListOutputSchema,
  codingOutpostExecInputSchema,
  codingOutpostExecOutputSchema,
  codingProjectContextSyncInputSchema,
  codingProjectContextSyncOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/coding.ts";

export const codingMethodDefs = {
  "coding.noteCreate": defineHabitatMethod({
    input: codingNoteCreateInputSchema,
    output: codingNoteCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "coding.noteList": defineHabitatMethod({
    input: codingNoteListInputSchema,
    output: codingNoteListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "coding.projectContextSync": defineHabitatMethod({
    input: codingProjectContextSyncInputSchema,
    output: codingProjectContextSyncOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "coding.outpostExec": defineHabitatMethod({
    input: codingOutpostExecInputSchema,
    output: codingOutpostExecOutputSchema,
    meta: longOpMeta(false),
  }),
} as const;
