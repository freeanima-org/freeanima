import { defineHubMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
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
} from "@freeanima/shared/sap-contract/frames/tag";

export const tagMethodDefs = {
  "tag.list": defineHubMethod({
    input: tagListInputSchema,
    output: tagListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "tag.search": defineHubMethod({
    input: tagSearchInputSchema,
    output: tagSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "tag.create": defineHubMethod({
    input: tagCreateInputSchema,
    output: tagCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tag.patch": defineHubMethod({
    input: tagPatchInputSchema,
    output: tagPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tag.delete": defineHubMethod({
    input: tagDeleteInputSchema,
    output: tagDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "tag.setOnEntity": defineHubMethod({
    input: tagSetOnEntityInputSchema,
    output: tagSetOnEntityOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;
