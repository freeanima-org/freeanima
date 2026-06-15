import { Elysia } from "elysia";
import { getSatellitesStatus } from "../../handlers/index.ts";

export const satellitesRoutes = new Elysia({ prefix: "/satellites" }).get("/status", () =>
  getSatellitesStatus(),
);
