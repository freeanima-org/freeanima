import { omitUndefined } from "@freeanima/core/util";
import { Elysia, t } from "elysia";
import {
  getDeepSleepRounds,
  getSleepPipelineStatus,
  getSleepSummary,
  listCronLogs,
  listPipelineStepRuns,
  startSleepCycle,
  startSleepPipelineStep,
} from "../../handlers/sleep.ts";

export const sleepRoutes = new Elysia({ prefix: "/sleep" })
  .get("/summary", () => getSleepSummary())
  .get(
    "/pipeline-runs",
    ({ query }) =>
      listPipelineStepRuns(
        omitUndefined({
          step_id: query.step_id,
          run_id: query.run_id,
          limit: query.limit,
          offset: query.offset,
        }),
      ),
    {
      query: t.Object({
        step_id: t.Optional(t.String()),
        run_id: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
        offset: t.Optional(t.Numeric()),
      }),
    },
  )
  .get("/deep-sleep/:day/rounds", ({ params }) => getDeepSleepRounds(params.day), {
    params: t.Object({ day: t.String() }),
  })
  .get("/pipeline/status", () => getSleepPipelineStatus())
  .post(
    "/pipeline/run",
    ({ body }) =>
      startSleepCycle(omitUndefined({ day: body.day, deep_sleep_mode: body.deep_sleep_mode })),
    {
      body: t.Object({
        day: t.Optional(t.String()),
        deep_sleep_mode: t.Optional(t.Union([t.Literal("full"), t.Literal("incremental")])),
      }),
    },
  )
  .post(
    "/pipeline/run-step",
    ({ body }) =>
      startSleepPipelineStep(
        omitUndefined({
          step_id: body.step_id,
          day: body.day,
          force: body.force,
          deep_sleep_mode: body.deep_sleep_mode,
        }),
      ),
    {
      body: t.Object({
        step_id: t.String(),
        day: t.Optional(t.String()),
        force: t.Optional(t.Boolean()),
        deep_sleep_mode: t.Optional(t.Union([t.Literal("full"), t.Literal("incremental")])),
      }),
    },
  );

export const cronLogRoutes = new Elysia({ prefix: "/cron-logs" }).get(
  "/",
  ({ query }) =>
    listCronLogs(
      omitUndefined({
        job_id: query.job_id,
        limit: query.limit,
        offset: query.offset,
        ok: query.ok,
      }),
    ),
  {
    query: t.Object({
      job_id: t.Optional(t.String()),
      limit: t.Optional(t.Numeric()),
      offset: t.Optional(t.Numeric()),
      ok: t.Optional(t.Boolean()),
    }),
  },
);
