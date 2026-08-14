import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
import {
  bookmarkCreateInputSchema,
  bookmarkCreateOutputSchema,
  bookmarkDeleteInputSchema,
  bookmarkDeleteOutputSchema,
  bookmarkGetInputSchema,
  bookmarkGetOutputSchema,
  bookmarkListInputSchema,
  bookmarkListOutputSchema,
  bookmarkPatchInputSchema,
  bookmarkPatchOutputSchema,
  bookmarkSearchInputSchema,
  bookmarkSearchOutputSchema,
  bookmarkSyncPullInputSchema,
  bookmarkSyncPullOutputSchema,
  bookmarkUpsertBatchInputSchema,
  bookmarkUpsertBatchOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/bookmark";

export const bookmarkMethodDefs = {
  "bookmark.list": defineHabitatMethod({
    input: bookmarkListInputSchema,
    output: bookmarkListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "bookmark.get": defineHabitatMethod({
    input: bookmarkGetInputSchema,
    output: bookmarkGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "bookmark.search": defineHabitatMethod({
    input: bookmarkSearchInputSchema,
    output: bookmarkSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "bookmark.create": defineHabitatMethod({
    input: bookmarkCreateInputSchema,
    output: bookmarkCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "bookmark.patch": defineHabitatMethod({
    input: bookmarkPatchInputSchema,
    output: bookmarkPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "bookmark.delete": defineHabitatMethod({
    input: bookmarkDeleteInputSchema,
    output: bookmarkDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "bookmark.upsert_batch": defineHabitatMethod({
    input: bookmarkUpsertBatchInputSchema,
    output: bookmarkUpsertBatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "bookmark.sync.pull": defineHabitatMethod({
    input: bookmarkSyncPullInputSchema,
    output: bookmarkSyncPullOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;
