import { Elysia } from "elysia";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

export const mcpRoutes = new Elysia({ prefix: "/mcp" })
  .get("/status", () => invokeConsoleHubHandler("mcp.status", {}))
  .post("/start-all", () => invokeConsoleHubHandler("mcp.startAll", {}))
  .post("/stop-all", () => invokeConsoleHubHandler("mcp.stopAll", {}))
  .post("/:name/start", ({ params }) =>
    invokeConsoleHubHandler("mcp.startServer", { name: params.name }),
  )
  .post("/:name/stop", ({ params }) =>
    invokeConsoleHubHandler("mcp.stopServer", { name: params.name }),
  );
