import { Elysia } from "elysia";
import {
  autobiographicalMemoryListBodySchema,
  limbicMemoryListBodySchema,
  memorySearchBodySchema,
  semanticMemoryListBodySchema,
  semanticMemoryPinBodySchema,
} from "../../api/schemas.ts";
import {
  countSemanticMemory,
  listAutobiographicalMemories,
  listLimbicMemories,
  listMemoryFiles,
  listSemanticMemories,
  memorySearch,
  updateSemanticMemoryPinned,
} from "../../handlers/index.ts";

export const memoryRoutes = new Elysia({ prefix: "/memory" })
  .get("/files", () => listMemoryFiles())
  .post("/search", ({ body }) => memorySearch(memorySearchBodySchema.parse(body)))
  .post("/semantic-memory/count", () => countSemanticMemory())
  .post("/semantic/list", ({ body }) =>
    listSemanticMemories(semanticMemoryListBodySchema.parse(body)),
  )
  .patch("/semantic/pinned", ({ body }) =>
    updateSemanticMemoryPinned(semanticMemoryPinBodySchema.parse(body)),
  )
  .post("/limbic/list", ({ body }) => listLimbicMemories(limbicMemoryListBodySchema.parse(body)))
  .post("/autobiographical/list", ({ body }) =>
    listAutobiographicalMemories(autobiographicalMemoryListBodySchema.parse(body)),
  );
