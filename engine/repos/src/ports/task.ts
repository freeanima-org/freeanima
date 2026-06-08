export const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["high", "medium", "low", "none"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  source_session_id: string | null;
};

export type TaskCreateInput = {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  due_at?: string | null;
  source_session_id?: string | null;
};

export type TaskUpdateInput = {
  id: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_at?: string | null;
  completed_at?: string | null;
};

export type TaskListOpts = {
  status?: TaskStatus[];
  priority?: TaskPriority;
  limit?: number;
};

/** 跨 session 待办持久化端口 */
export interface TaskStorePort {
  create(input: TaskCreateInput): Promise<TaskRow>;
  get(id: string): Promise<TaskRow | null>;
  update(input: TaskUpdateInput): Promise<TaskRow | null>;
  list(opts?: TaskListOpts): Promise<TaskRow[]>;
}
