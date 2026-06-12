import { Elysia } from "elysia";
import { listFridgeMagnets } from "../../handlers/index.ts";

export const fridgeMagnetRoutes = new Elysia({ prefix: "/fridge-magnet" }).get("/magnets", () =>
  listFridgeMagnets(),
);
