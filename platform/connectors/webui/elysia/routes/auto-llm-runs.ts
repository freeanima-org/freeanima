import { Elysia, t } from "elysia";
import { listAutoLlmRuns } from "../../handlers/auto-llm-runs.ts";

export const autoLlmRunRoutes = new Elysia({ prefix: "/auto-llm-runs" }).get(
  "/",
  ({ query }) =>
    listAutoLlmRuns({
      run_kind: query.run_kind,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    }),
  {
    query: t.Object({
      run_kind: t.Optional(t.String()),
      status: t.Optional(t.Union([t.Literal("ok"), t.Literal("error")])),
      limit: t.Optional(t.Numeric()),
      offset: t.Optional(t.Numeric()),
    }),
  },
);
