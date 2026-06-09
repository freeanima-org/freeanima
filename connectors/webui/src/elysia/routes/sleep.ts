import { Elysia, t } from "elysia";
import {
  getDeepSleepRounds,
  getSleepSummary,
  listCronLogs,
  listSleepRuns,
} from "../../handlers/sleep.ts";

export const sleepRoutes = new Elysia({ prefix: "/sleep" })
  .get("/summary", () => getSleepSummary())
  .get(
    "/runs",
    ({ query }) =>
      listSleepRuns({
        limit: query.limit,
        offset: query.offset,
        ok: query.ok,
      }),
    {
      query: t.Object({
        limit: t.Optional(t.Numeric()),
        offset: t.Optional(t.Numeric()),
        ok: t.Optional(t.Boolean()),
      }),
    },
  )
  .get("/deep-sleep/:day/rounds", ({ params }) => getDeepSleepRounds(params.day), {
    params: t.Object({ day: t.String() }),
  });

export const cronLogRoutes = new Elysia({ prefix: "/cron-logs" }).get(
  "/",
  ({ query }) =>
    listCronLogs({
      job_id: query.job_id,
      limit: query.limit,
      offset: query.offset,
      ok: query.ok,
    }),
  {
    query: t.Object({
      job_id: t.Optional(t.String()),
      limit: t.Optional(t.Numeric()),
      offset: t.Optional(t.Numeric()),
      ok: t.Optional(t.Boolean()),
    }),
  },
);
