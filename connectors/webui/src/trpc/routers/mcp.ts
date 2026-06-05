import { z } from "zod";
import {
  getMcpStatus,
  mcpStartAll,
  mcpStartServer,
  mcpStopAll,
  mcpStopServer,
} from "../../handlers/index.ts";
import { publicProcedure, router } from "../trpc.ts";

export const mcpRouter = router({
  status: publicProcedure.query(() => getMcpStatus()),
  startAll: publicProcedure.mutation(() => mcpStartAll()),
  stopAll: publicProcedure.mutation(() => mcpStopAll()),
  start: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(({ input }) => mcpStartServer(input.name)),
  stop: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(({ input }) => mcpStopServer(input.name)),
});
