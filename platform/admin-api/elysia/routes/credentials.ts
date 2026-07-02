import { Elysia } from "elysia";

export const credentialsRoutes = new Elysia({ prefix: "/credentials" }).get("/", () => ({
  deprecated: true,
  message: "pass credentials removed; use Shell /vault and vault() config DSL",
  vault_shell_path: "/web/vault",
}));
