import { Elysia } from "elysia";
import { z } from "zod";
import { getCredentialDetailHandler, listCredentialMetas } from "../../handlers/index.ts";

const detailQuerySchema = z.object({ path: z.string().min(1) });

export const credentialsRoutes = new Elysia({ prefix: "/credentials" })
  .get("/", () => listCredentialMetas())
  .get("/detail", ({ query }) => getCredentialDetailHandler(detailQuerySchema.parse(query).path), {
    query: detailQuerySchema,
  });
