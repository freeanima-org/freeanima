import { Elysia, t } from "elysia";
import {
  getDeepSleepRounds,
  getSleepPipelineStatus,
  getSleepSummary,
  listCronLogs,
  listSleepRuns,
  startSleepCycle,
  startSleepPipelineStep,
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
  })
  .get("/pipeline/status", () => getSleepPipelineStatus())
  .post("/pipeline/run", ({ body }) => startSleepCycle({ day: body.day }), {
    body: t.Object({
      day: t.Optional(t.String()),
    }),
  })
  .post(
    "/pipeline/run-step",
    ({ body }) =>
      startSleepPipelineStep({
        step_id: body.step_id,
        day: body.day,
        force: body.force,
      }),
    {
      body: t.Object({
        step_id: t.String(),
        day: t.Optional(t.String()),
        force: t.Optional(t.Boolean()),
      }),
    },
  );

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
