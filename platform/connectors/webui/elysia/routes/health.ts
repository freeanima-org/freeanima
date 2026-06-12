import { Elysia } from "elysia";
import { getHealth } from "../../handlers/index.ts";

export const healthRoutes = new Elysia().get("/health", () => getHealth());
