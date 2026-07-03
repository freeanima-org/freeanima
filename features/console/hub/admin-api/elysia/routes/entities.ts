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
import {
  createSubjectEntity,
  createWorldEntity,
  getSubjectEntity,
  getWorldEntity,
  listSubjectEntities,
  listWorldEntities,
  searchEntities,
  updateSubjectEntity,
  updateWorldEntity,
} from "../../handlers/index.ts";

export const entityRoutes = new Elysia({ prefix: "/entities" })
  .get("/search", ({ query, request }) =>
    searchEntities(omitUndefined(entitySearchQuerySchema.parse(query)), request),
  )
  .post("/search", ({ body, request }) =>
    searchEntities(omitUndefined(entitySearchBodySchema.parse(body)), request),
  )
  .get("/worlds", ({ query }) =>
    listWorldEntities(omitUndefined(entityListQuerySchema.parse(query))),
  )
  .post("/worlds", ({ body }) =>
    createWorldEntity(omitUndefined(worldEntityCreateBodySchema.parse(body))),
  )
  .get("/worlds/:id", ({ params }) => getWorldEntity(entityIdParamsSchema.parse(params).id))
  .patch("/worlds/:id", ({ params, body }) =>
    updateWorldEntity(
      entityIdParamsSchema.parse(params).id,
      omitUndefined(worldEntityUpdateBodySchema.parse(body)),
    ),
  )
  .get("/subjects", ({ query }) =>
    listSubjectEntities(omitUndefined(entityListQuerySchema.parse(query))),
  )
  .post("/subjects", ({ body }) => createSubjectEntity(subjectEntityCreateBodySchema.parse(body)))
  .get("/subjects/:id", ({ params }) => getSubjectEntity(entityIdParamsSchema.parse(params).id))
  .patch("/subjects/:id", ({ params, body }) =>
    updateSubjectEntity(
      entityIdParamsSchema.parse(params).id,
      omitUndefined(subjectEntityUpdateBodySchema.parse(body)),
    ),
  );
