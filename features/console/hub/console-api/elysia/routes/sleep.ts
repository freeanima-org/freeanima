import { omitUndefined } from "@freeanima/core/util";
import { Elysia, t } from "elysia";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";
import { listPipelineStepRuns } from "../../handlers/sleep.ts";

export const sleepRoutes = new Elysia({ prefix: "/sleep" })
  .get("/summary", () => invokeConsoleHubHandler("sleep.summary", {}))
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
  .get("/deep-sleep/:day/rounds", ({ params }) =>
    invokeConsoleHubHandler("sleep.deepSleepRounds", { day: params.day }),
  )
  .get("/pipeline/status", () => invokeConsoleHubHandler("sleep.pipelineStatus", {}))
  .post(
    "/pipeline/run",
    ({ body }) =>
      invokeConsoleHubHandler(
        "sleep.startCycle",
        omitUndefined({ day: body.day, deep_sleep_mode: body.deep_sleep_mode }),
      ),
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
      invokeConsoleHubHandler(
        "sleep.runPipelineStep",
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
    invokeConsoleHubHandler(
      "cronLogs.list",
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
