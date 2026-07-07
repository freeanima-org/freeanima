import { Elysia } from "elysia";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

const sectionParamSchema = { params: { section: String } };

function resolveConfigSectionPatch(body: unknown): Record<string, unknown> {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return {};
  const record = body as Record<string, unknown>;
  const nested = record.patch;
  if (nested != null && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return record;
}

export const configRoutes = new Elysia({ prefix: "/config" })
  .get("/", () => invokeConsoleHubHandler("config.get", {}))
  .get("/:section", ({ params }) =>
    invokeConsoleHubHandler("config.getSection", { section: params.section }),
  )
  .patch("/:section", ({ params, body }) =>
    invokeConsoleHubHandler("config.patchSection", {
      section: params.section,
      patch: resolveConfigSectionPatch(body),
    }),
  )
  .post("/import-from-file", () => invokeConsoleHubHandler("config.importFromFile", {}));

export { sectionParamSchema };
