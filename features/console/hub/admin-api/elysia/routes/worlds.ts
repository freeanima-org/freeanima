import { Elysia } from "elysia";
import { getResolvedWorldContext } from "@freeanima/core/config/world-context";

export const worldsRoutes = new Elysia({ prefix: "/worlds" }).get("/context", () =>
  getResolvedWorldContext(),
);
