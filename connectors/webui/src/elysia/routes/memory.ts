import { Elysia } from "elysia";
import { memorySearchBodySchema } from "../../api/schemas.ts";
import { listMemoryFiles, memoryL3Reindex, memorySearch } from "../../handlers/index.ts";

export const memoryRoutes = new Elysia({ prefix: "/memory" })
  .get("/files", () => listMemoryFiles())
  .post("/search", ({ body }) => memorySearch(memorySearchBodySchema.parse(body)))
  .post("/l3-reindex", () => memoryL3Reindex());
