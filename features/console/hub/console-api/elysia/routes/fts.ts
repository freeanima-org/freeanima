import { omitUndefined } from "@freeanima/core/util";
import { Elysia, t } from "elysia";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

export const ftsRoutes = new Elysia({ prefix: "/fts" })
  .get("/status", () => invokeConsoleHubHandler("fts.status", {}))
  .get("/rebuild/status", () => invokeConsoleHubHandler("fts.rebuildStatus", {}))
  .post(
    "/rebuild",
    ({ body }) =>
      invokeConsoleHubHandler("fts.rebuild", omitUndefined({ only_missing: body.only_missing })),
    {
      body: t.Object({
        only_missing: t.Optional(t.Boolean()),
      }),
    },
  );
