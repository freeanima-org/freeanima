import { Elysia } from "elysia";
import { z } from "zod";

import { entityIdParamsSchema } from "../../api/schemas.ts";
import {
  createSubjectApiToken,
  listSubjectApiTokens,
  revokeSubjectApiToken,
} from "../../handlers/service-api-tokens.ts";

const createTokenBodySchema = z.object({
  name: z.string().min(1),
});

const tokenIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const serviceApiTokenRoutes = new Elysia()
  .get("/subjects/:id/tokens", ({ params, request }) =>
    listSubjectApiTokens(request, entityIdParamsSchema.parse(params).id),
  )
  .post("/subjects/:id/tokens", ({ params, body, request }) =>
    createSubjectApiToken(
      request,
      entityIdParamsSchema.parse(params).id,
      createTokenBodySchema.parse(body),
    ),
  )
  .delete("/tokens/:id", ({ params, request }) =>
    revokeSubjectApiToken(request, tokenIdParamsSchema.parse(params).id),
  );
