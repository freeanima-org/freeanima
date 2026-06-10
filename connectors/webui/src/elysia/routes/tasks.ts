import { Elysia } from "elysia";
import { taskListBodySchema } from "../../api/schemas.ts";
import { listTasks } from "../../handlers/index.ts";

export const tasksRoutes = new Elysia({ prefix: "/tasks" }).post("/list", ({ body }) =>
  listTasks(taskListBodySchema.parse(body)),
);
