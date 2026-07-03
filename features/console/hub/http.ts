/** Console Hub HTTP (REST) — colocated console-api under features/console/hub. */
export { apiApp, createApiApp, type App } from "./console-api/elysia/app.ts";
export { startApiHttpServer, startApiHttpServers } from "./console-api/server.ts";
