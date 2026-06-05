import { z } from "zod";
import {
  acpStartAgent,
  acpStartAll,
  acpStopAgent,
  acpStopAll,
  getAcpStatus,
} from "../../handlers/index.ts";
import { publicProcedure, router } from "../trpc.ts";

export const acpRouter = router({
  status: publicProcedure.query(() => getAcpStatus()),
  startAll: publicProcedure.mutation(() => acpStartAll()),
  stopAll: publicProcedure.mutation(() => acpStopAll()),
  start: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(({ input }) => acpStartAgent(input.name)),
  stop: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(({ input }) => acpStopAgent(input.name)),
});
