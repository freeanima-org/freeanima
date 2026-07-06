import { Elysia } from "elysia";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

export const acpRoutes = new Elysia({ prefix: "/acp" })
  .get("/status", () => invokeConsoleHubHandler("acp.status", {}))
  .post("/start-all", () => invokeConsoleHubHandler("acp.startAll", {}))
  .post("/stop-all", () => invokeConsoleHubHandler("acp.stopAll", {}))
  .post("/:name/start", ({ params }) =>
    invokeConsoleHubHandler("acp.startAgent", { name: params.name }),
  )
  .post("/:name/stop", ({ params }) =>
    invokeConsoleHubHandler("acp.stopAgent", { name: params.name }),
  );
