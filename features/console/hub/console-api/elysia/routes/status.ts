import { Elysia } from "elysia";
import { z } from "zod";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

export const statusRoutes = new Elysia({ prefix: "/status" })
  .get("/", () => invokeConsoleHubHandler("status.get", {}))
  .get("/config", () => invokeConsoleHubHandler("status.config", {}))
  .get("/tools", ({ query }) =>
    invokeConsoleHubHandler("status.tools", {
      scope: query.scope === "default" ? "default" : undefined,
    }),
  )
  .get("/platforms", () => invokeConsoleHubHandler("status.platforms", {}))
  .get("/cron-jobs", () => invokeConsoleHubHandler("status.cronJobs", {}))
  .post("/cron-jobs/:id/pause", ({ params }) =>
    invokeConsoleHubHandler("status.cronJobPause", { id: params.id }),
  )
  .post("/cron-jobs/:id/resume", ({ params }) =>
    invokeConsoleHubHandler("status.cronJobResume", { id: params.id }),
  )
  .post("/cron-jobs/:id/run", ({ params }) =>
    invokeConsoleHubHandler("status.cronJobRun", { id: params.id }),
  )
  .post("/restart", () => invokeConsoleHubHandler("status.restart", {}));

export const statusCronBodySchema = z.object({ id: z.string() });
