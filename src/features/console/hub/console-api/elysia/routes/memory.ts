import { Elysia } from "elysia";
import {
  autobiographicalMemoryListBodySchema,
  limbicMemoryListBodySchema,
  memorySearchBodySchema,
  semanticMemoryListBodySchema,
  semanticMemoryPinBodySchema,
} from "../../api/schemas.ts";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

export const memoryRoutes = new Elysia({ prefix: "/memory" })
  .get("/files", () => invokeConsoleHubHandler("memory.files", {}))
  .post("/search", ({ body }) =>
    invokeConsoleHubHandler("memory.search", memorySearchBodySchema.parse(body)),
  )
  .post("/semantic-memory/count", () => invokeConsoleHubHandler("memory.semanticCount", {}))
  .post("/semantic/list", ({ body }) =>
    invokeConsoleHubHandler("memory.semanticList", semanticMemoryListBodySchema.parse(body)),
  )
  .patch("/semantic/pinned", ({ body }) =>
    invokeConsoleHubHandler("memory.semanticPin", semanticMemoryPinBodySchema.parse(body)),
  )
  .post("/limbic/list", ({ body }) =>
    invokeConsoleHubHandler("memory.limbicList", limbicMemoryListBodySchema.parse(body)),
  )
  .post("/autobiographical/list", ({ body }) =>
    invokeConsoleHubHandler(
      "memory.autobiographicalList",
      autobiographicalMemoryListBodySchema.parse(body),
    ),
  );
