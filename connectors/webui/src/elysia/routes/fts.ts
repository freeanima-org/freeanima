import { Elysia } from "elysia";
import { getFtsStatus, rebuildFtsIndex } from "../../handlers/fts.ts";

export const ftsRoutes = new Elysia({ prefix: "/fts" })
  .get("/status", () => getFtsStatus())
  .post("/rebuild", () => rebuildFtsIndex());
