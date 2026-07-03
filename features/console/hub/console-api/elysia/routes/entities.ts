import { omitUndefined } from "@freeanima/core/util";
import { Elysia } from "elysia";
import {
  entityIdParamsSchema,
  entityListQuerySchema,
  entitySearchBodySchema,
  entitySearchQuerySchema,
  subjectEntityCreateBodySchema,
  subjectEntityUpdateBodySchema,
  worldEntityCreateBodySchema,
  worldEntityUpdateBodySchema,
} from "../../api/schemas.ts";
import { invokeConsoleHubHandler } from "../../console-hub-handlers.ts";
import { searchEntities } from "../../handlers/entities.ts";

export const entityRoutes = new Elysia({ prefix: "/entities" })
  .get("/search", ({ query, request }) =>
    searchEntities(omitUndefined(entitySearchQuerySchema.parse(query)), request),
  )
  .post("/search", ({ body, request }) =>
    searchEntities(omitUndefined(entitySearchBodySchema.parse(body)), request),
  )
  .get("/worlds", ({ query }) =>
    invokeConsoleHubHandler("entity.worldsList", omitUndefined(entityListQuerySchema.parse(query))),
  )
  .post("/worlds", ({ body }) =>
    invokeConsoleHubHandler(
      "entity.worldsCreate",
      omitUndefined(worldEntityCreateBodySchema.parse(body)),
    ),
  )
  .get("/worlds/:id", ({ params }) =>
    invokeConsoleHubHandler("entity.worldsGet", {
      id: String(entityIdParamsSchema.parse(params).id),
    }),
  )
  .patch("/worlds/:id", ({ params, body }) =>
    invokeConsoleHubHandler("entity.worldsPatch", {
      id: String(entityIdParamsSchema.parse(params).id),
      ...omitUndefined(worldEntityUpdateBodySchema.parse(body)),
    }),
  )
  .get("/subjects", ({ query }) =>
    invokeConsoleHubHandler(
      "entity.subjectsList",
      omitUndefined(entityListQuerySchema.parse(query)),
    ),
  )
  .post("/subjects", ({ body }) =>
    invokeConsoleHubHandler("entity.subjectsCreate", subjectEntityCreateBodySchema.parse(body)),
  )
  .get("/subjects/:id", ({ params }) =>
    invokeConsoleHubHandler("entity.subjectsGet", {
      id: String(entityIdParamsSchema.parse(params).id),
    }),
  )
  .patch("/subjects/:id", ({ params, body }) =>
    invokeConsoleHubHandler("entity.subjectsPatch", {
      id: String(entityIdParamsSchema.parse(params).id),
      ...omitUndefined(subjectEntityUpdateBodySchema.parse(body)),
    }),
  );
