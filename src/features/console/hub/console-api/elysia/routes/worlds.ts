import { Elysia } from "elysia";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

export const worldsRoutes = new Elysia({ prefix: "/worlds" }).get("/context", () =>
  invokeConsoleHubHandler("worlds.context", {}),
);
