import { Elysia } from "elysia";
import { listFridgeMagnets } from "../../handlers/index.ts";

export const fridgeRoutes = new Elysia({ prefix: "/fridge" }).get("/magnets", () =>
  listFridgeMagnets(),
);
