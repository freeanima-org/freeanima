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
import { publicProcedure, router } from "../trpc.ts";

export const statusRouter = router({
  get: publicProcedure.query(() => getStatus()),
  config: publicProcedure.query(() => getConfig()),
  tools: publicProcedure.query(() => listTools()),
  platforms: publicProcedure.query(() => getPlatforms()),
  cronJobs: publicProcedure.query(() => listCronJobs()),
  pauseCron: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => pauseCronJob(input.id)),
  resumeCron: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => resumeCronJob(input.id)),
  runCron: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => runCronJobNow(input.id)),
  restart: publicProcedure.mutation(() => restartService()),
});
