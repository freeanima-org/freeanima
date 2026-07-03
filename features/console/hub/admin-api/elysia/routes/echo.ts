import { Elysia } from "elysia";
import { buildEchoSnapshot } from "../../handlers/echo.ts";

export const echoRoutes = new Elysia().all("/echo", async ({ request }) =>
  buildEchoSnapshot(request),
);
