import type {
  TaskCreateInput,
  TaskListOpts,
  TaskRow,
  TaskStorePort,
  TaskUpdateInput,
} from "@freeanima/core/repos";

import * as crudRepo from "./repos/task-crud-repo.ts";

/** PostgreSQL TaskStorePort implementation */
export const pgTaskStore: TaskStorePort = {
  create: (input: TaskCreateInput): Promise<TaskRow> => crudRepo.createTask(input),
  get: (id: string): Promise<TaskRow | null> => crudRepo.getTask(id),
  update: (input: TaskUpdateInput): Promise<TaskRow | null> => crudRepo.updateTask(input),
  list: (opts?: TaskListOpts): Promise<TaskRow[]> => crudRepo.listTasks(opts),
  count: (opts?: Omit<TaskListOpts, "offset" | "limit">): Promise<number> =>
    crudRepo.countTasks(opts),
};
