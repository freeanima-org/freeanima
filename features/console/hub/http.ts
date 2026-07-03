/** Console Hub HTTP (REST) — colocated admin-api under features/console/hub. */
export { apiApp, createApiApp, type App } from "./admin-api/elysia/app.ts";
export { startApiHttpServer, startApiHttpServers } from "./admin-api/server.ts";
