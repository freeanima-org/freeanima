import { Elysia } from "elysia";
import { getHealthProbe } from "../../handlers/index.ts";

export const healthRoutes = new Elysia().get("/health", ({ request }) => getHealthProbe(request));
