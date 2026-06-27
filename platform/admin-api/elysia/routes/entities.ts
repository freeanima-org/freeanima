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
  .get("/search", ({ query }) => searchEntities(entitySearchQuerySchema.parse(query)))
  .post("/search", ({ body }) => searchEntities(entitySearchBodySchema.parse(body)))
  .get("/worlds", ({ query }) => listWorldEntities(entityListQuerySchema.parse(query)))
  .post("/worlds", ({ body }) => createWorldEntity(worldEntityCreateBodySchema.parse(body)))
  .get("/worlds/:id", ({ params }) => getWorldEntity(entityIdParamsSchema.parse(params).id))
  .patch("/worlds/:id", ({ params, body }) =>
    updateWorldEntity(
      entityIdParamsSchema.parse(params).id,
      worldEntityUpdateBodySchema.parse(body),
    ),
  )
  .get("/subjects", ({ query }) => listSubjectEntities(entityListQuerySchema.parse(query)))
  .post("/subjects", ({ body }) => createSubjectEntity(subjectEntityCreateBodySchema.parse(body)))
  .get("/subjects/:id", ({ params }) => getSubjectEntity(entityIdParamsSchema.parse(params).id))
  .patch("/subjects/:id", ({ params, body }) =>
    updateSubjectEntity(
      entityIdParamsSchema.parse(params).id,
      subjectEntityUpdateBodySchema.parse(body),
    ),
  );
