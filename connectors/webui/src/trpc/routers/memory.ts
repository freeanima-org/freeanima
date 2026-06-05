import { memorySearchBodySchema } from "../../api/schemas.ts";
import {
  listMemoryFiles,
  memoryL2Distill,
  memoryL2Rebuild,
  memoryL2Reindex,
  memoryL3Reindex,
  memorySearch,
} from "../../handlers/index.ts";
import { publicProcedure, router } from "../trpc.ts";

export const memoryRouter = router({
  files: publicProcedure.query(() => listMemoryFiles()),
  search: publicProcedure
    .input(memorySearchBodySchema)
    .mutation(({ input }) => memorySearch(input)),
  l2Distill: publicProcedure.mutation(() => memoryL2Distill()),
  l2Reindex: publicProcedure.mutation(() => memoryL2Reindex()),
  l3Reindex: publicProcedure.mutation(() => memoryL3Reindex()),
  l2Rebuild: publicProcedure.mutation(() => memoryL2Rebuild()),
});
