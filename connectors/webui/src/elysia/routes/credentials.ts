import { Elysia } from "elysia";
import { listCredentialMetas } from "../../handlers/index.ts";

export const credentialsRoutes = new Elysia({ prefix: "/credentials" }).get("/", () =>
  listCredentialMetas(),
);
