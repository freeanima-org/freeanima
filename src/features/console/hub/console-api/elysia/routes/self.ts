import { Elysia } from "elysia";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";

export const selfRoutes = new Elysia({ prefix: "/self" }).get("/blocks", () =>
  invokeConsoleHubHandler("self.blocks", {}),
);
