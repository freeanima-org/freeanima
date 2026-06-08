import { Elysia } from "elysia";
import {
  getMcpStatus,
  mcpStartAll,
  mcpStartServer,
  mcpStopAll,
  mcpStopServer,
} from "../../handlers/index.ts";

export const mcpRoutes = new Elysia({ prefix: "/mcp" })
  .get("/status", () => getMcpStatus())
  .post("/start-all", () => mcpStartAll())
  .post("/stop-all", () => mcpStopAll())
  .post("/:name/start", ({ params }) => mcpStartServer(params.name))
  .post("/:name/stop", ({ params }) => mcpStopServer(params.name));
