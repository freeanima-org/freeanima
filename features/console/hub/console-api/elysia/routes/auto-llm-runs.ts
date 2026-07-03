import { omitUndefined } from "@freeanima/core/util";
import { Elysia, t } from "elysia";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

export const autoLlmRunRoutes = new Elysia({ prefix: "/auto-llm-runs" }).get(
  "/",
  ({ query }) =>
    invokeConsoleHubHandler(
      "autoLlmRuns.list",
      omitUndefined({
        run_kind: query.run_kind,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      }),
    ),
  {
    query: t.Object({
      run_kind: t.Optional(t.String()),
      status: t.Optional(t.Union([t.Literal("ok"), t.Literal("error")])),
      limit: t.Optional(t.Numeric()),
      offset: t.Optional(t.Numeric()),
    }),
  },
);
