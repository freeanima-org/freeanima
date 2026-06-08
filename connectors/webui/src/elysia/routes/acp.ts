import { Elysia } from "elysia";
import {
  acpStartAgent,
  acpStartAll,
  acpStopAgent,
  acpStopAll,
  getAcpStatus,
} from "../../handlers/index.ts";

export const acpRoutes = new Elysia({ prefix: "/acp" })
  .get("/status", () => getAcpStatus())
  .post("/start-all", () => acpStartAll())
  .post("/stop-all", () => acpStopAll())
  .post("/:name/start", ({ params }) => acpStartAgent(params.name))
  .post("/:name/stop", ({ params }) => acpStopAgent(params.name));
