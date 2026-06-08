import { Elysia } from "elysia";
import { memorySearchBodySchema } from "../../api/schemas.ts";
import { countSemanticMemory, listMemoryFiles, memorySearch } from "../../handlers/index.ts";

export const memoryRoutes = new Elysia({ prefix: "/memory" })
  .get("/files", () => listMemoryFiles())
  .post("/search", ({ body }) => memorySearch(memorySearchBodySchema.parse(body)))
  .post("/semantic-memory/count", () => countSemanticMemory());
