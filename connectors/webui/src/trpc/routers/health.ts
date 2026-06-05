import { getHealth } from "../../handlers/index.ts";
import { publicProcedure, router } from "../trpc.ts";

export const healthRouter = router({
  check: publicProcedure.query(() => getHealth()),
});
