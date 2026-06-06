import { memorySearchBodySchema } from "../../api/schemas.ts";
import { listMemoryFiles, memoryL3Reindex, memorySearch } from "../../handlers/index.ts";
import { publicProcedure, router } from "../trpc.ts";

export const memoryRouter = router({
  files: publicProcedure.query(() => listMemoryFiles()),
  search: publicProcedure
    .input(memorySearchBodySchema)
    .mutation(({ input }) => memorySearch(input)),
  l3Reindex: publicProcedure.mutation(() => memoryL3Reindex()),
});
