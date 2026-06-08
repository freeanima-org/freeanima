import type {
  TaskCreateInput,
  TaskListOpts,
  TaskRow,
  TaskStorePort,
  TaskUpdateInput,
} from "@freeanima/engine-repos";

import * as crudRepo from "./repos/task-crud-repo.ts";

/** PostgreSQL TaskStorePort 实现 */
export class PgTaskStore implements TaskStorePort {
  async create(input: TaskCreateInput): Promise<TaskRow> {
    return crudRepo.createTask(input);
  }

  async get(id: string): Promise<TaskRow | null> {
    return crudRepo.getTask(id);
  }

  async update(input: TaskUpdateInput): Promise<TaskRow | null> {
    return crudRepo.updateTask(input);
  }

  async list(opts?: TaskListOpts): Promise<TaskRow[]> {
    return crudRepo.listTasks(opts);
  }
}
