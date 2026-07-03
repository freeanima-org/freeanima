import { Elysia } from "elysia";
import { z } from "zod";
import {
  getConfig,
  getPlatforms,
  getStatus,
  listCronJobs,
  listTools,
  pauseCronJob,
  restartService,
  resumeCronJob,
  runCronJobNow,
} from "../../handlers/index.ts";

export const statusRoutes = new Elysia({ prefix: "/status" })
  .get("/", () => getStatus())
  .get("/config", () => getConfig())
  .get("/tools", ({ query }) => listTools(query.scope === "default" ? "default" : undefined))
  .get("/platforms", () => getPlatforms())
  .get("/cron-jobs", () => listCronJobs())
  .post("/cron-jobs/:id/pause", ({ params }) => pauseCronJob(params.id))
  .post("/cron-jobs/:id/resume", ({ params }) => resumeCronJob(params.id))
  .post("/cron-jobs/:id/run", ({ params }) => runCronJobNow(params.id))
  .post("/restart", () => restartService());

export const statusCronBodySchema = z.object({ id: z.string() });
