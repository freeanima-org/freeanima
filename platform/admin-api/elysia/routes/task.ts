import { Elysia, t } from "elysia";

import {
  getEntityTaskItems,
  getEntityTaskLists,
  patchEntityTaskItem,
  patchEntityTaskList,
  postEntityTaskItem,
  postEntityTaskItemComplete,
  postEntityTaskItemUncomplete,
  postEntityTaskList,
  removeEntityTaskItem,
  removeEntityTaskList,
} from "../../handlers/entity-task.ts";

export const entityTaskRoutes = new Elysia({ prefix: "/task" })
  .get("/lists", () => getEntityTaskLists())
  .post("/lists", ({ body }) => postEntityTaskList(body))
  .patch("/lists/:id", ({ params, body }) => patchEntityTaskList(Number(params.id), body))
  .delete("/lists/:id", ({ params, query }) =>
    removeEntityTaskList(Number(params.id), query.cascade === "true"),
  )
  .get(
    "/items",
    ({ query }) =>
      getEntityTaskItems({
        list_id: query.list_id,
        status: query.status,
        due_today: query.due_today,
        tags: query.tags,
      }),
    {
      query: t.Object({
        list_id: t.Optional(t.String()),
        status: t.Optional(t.String()),
        due_today: t.Optional(t.String()),
        tags: t.Optional(t.String()),
      }),
    },
  )
  .post("/items", ({ body }) => postEntityTaskItem(body))
  .patch("/items/:id", ({ params, body }) => patchEntityTaskItem(Number(params.id), body))
  .post("/items/:id/complete", ({ params }) => postEntityTaskItemComplete(Number(params.id)))
  .post("/items/:id/uncomplete", ({ params }) => postEntityTaskItemUncomplete(Number(params.id)))
  .delete("/items/:id", ({ params }) => removeEntityTaskItem(Number(params.id)));
