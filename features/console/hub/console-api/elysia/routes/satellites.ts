import { Elysia } from "elysia";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

export const satellitesRoutes = new Elysia({ prefix: "/satellites" }).get("/status", () =>
  invokeConsoleHubHandler("satellites.status", {}),
);
