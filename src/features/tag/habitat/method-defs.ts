import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
import {
  tagCreateInputSchema,
  tagCreateOutputSchema,
  tagDeleteInputSchema,
  tagDeleteOutputSchema,
  tagListInputSchema,
  tagListOutputSchema,
  tagPatchInputSchema,
  tagPatchOutputSchema,
  tagSearchInputSchema,
  tagSearchOutputSchema,
  tagSetOnEntityInputSchema,
  tagSetOnEntityOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/tag";

export const tagMethodDefs = {
  "tag.list": defineHabitatMethod({
    input: tagListInputSchema,
    output: tagListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "tag.search": defineHabitatMethod({
    input: tagSearchInputSchema,
    output: tagSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "tag.create": defineHabitatMethod({
    input: tagCreateInputSchema,
    output: tagCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tag.patch": defineHabitatMethod({
    input: tagPatchInputSchema,
    output: tagPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tag.delete": defineHabitatMethod({
    input: tagDeleteInputSchema,
    output: tagDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tag.setOnEntity": defineHabitatMethod({
    input: tagSetOnEntityInputSchema,
    output: tagSetOnEntityOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;
