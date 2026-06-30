import { omitUndefined } from "@freeanima/core/util";
import { Elysia, t } from "elysia";
import { getFtsStatus, getRebuildFtsJobStatus, startRebuildFtsIndex } from "../../handlers/fts.ts";

export const ftsRoutes = new Elysia({ prefix: "/fts" })
  .get("/status", () => getFtsStatus())
  .get("/rebuild/status", () => getRebuildFtsJobStatus())
  .post(
    "/rebuild",
    ({ body }) => startRebuildFtsIndex(omitUndefined({ onlyMissing: body.only_missing })),
    {
      body: t.Object({
        only_missing: t.Optional(t.Boolean()),
      }),
    },
  );
