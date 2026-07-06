import { Elysia } from "elysia";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

const sectionParamSchema = { params: { section: String } };

export const configRoutes = new Elysia({ prefix: "/config" })
  .get("/", () => invokeConsoleHubHandler("config.get", {}))
  .get("/:section", ({ params }) =>
    invokeConsoleHubHandler("config.getSection", { section: params.section }),
  )
  .patch("/:section", ({ params, body }) =>
    invokeConsoleHubHandler("config.patchSection", {
      section: params.section,
      patch: body as Record<string, unknown>,
    }),
  )
  .post("/import-from-file", () => invokeConsoleHubHandler("config.importFromFile", {}));

export { sectionParamSchema };
