import { Elysia } from "elysia";
import { listSelfBlocks } from "../../handlers/index.ts";

export const selfRoutes = new Elysia({ prefix: "/self" }).get("/blocks", () => listSelfBlocks());
