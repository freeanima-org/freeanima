import type {
  TaskCreateInput,
  TaskListOpts,
  TaskRow,
  TaskStorePort,
  TaskUpdateInput,
} from "../ports/task.ts";

function notConfigured(): never {
  throw new Error("TaskStore 未配置（PostgreSQL 不可用）");
}

export const nullTaskStore: TaskStorePort = {
  async create(_input: TaskCreateInput): Promise<TaskRow> {
    return notConfigured();
  },
  async get(_id: string): Promise<TaskRow | null> {
    return notConfigured();
  },
  async update(_input: TaskUpdateInput): Promise<TaskRow | null> {
    return notConfigured();
  },
  async list(_opts?: TaskListOpts): Promise<TaskRow[]> {
    return notConfigured();
  },
};
