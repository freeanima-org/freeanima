import type {
  TaskCreateInput,
  TaskListOpts,
  TaskRow,
  TaskStorePort,
  TaskUpdateInput,
} from "@freeanima/engine-repos";

import { pgProfileWrap } from "../pg-profile.ts";
import * as crudRepo from "./repos/task-crud-repo.ts";

/** PostgreSQL TaskStorePort 实现 */
export class PgTaskStore implements TaskStorePort {
  async create(input: TaskCreateInput): Promise<TaskRow> {
    return pgProfileWrap("tasks.create", () => crudRepo.createTask(input));
  }

  async get(id: string): Promise<TaskRow | null> {
    return pgProfileWrap("tasks.get", () => crudRepo.getTask(id));
  }

  async update(input: TaskUpdateInput): Promise<TaskRow | null> {
    return pgProfileWrap("tasks.update", () => crudRepo.updateTask(input));
  }

  async list(opts?: TaskListOpts): Promise<TaskRow[]> {
    return pgProfileWrap("tasks.list", () => crudRepo.listTasks(opts));
  }
}
