import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
import {
  codingNoteCreateInputSchema,
  codingNoteCreateOutputSchema,
  codingNoteListInputSchema,
  codingNoteListOutputSchema,
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
} as const;
