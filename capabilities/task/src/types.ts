import type { TaskItemPriority, TaskItemStatus } from "@freeanima/core/db/schema/entity";

export type TaskListRow = {
  id: number;
  name: string;
  sort_order: number;
  closed: boolean;
  color: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
};

export type TaskListCreateInput = {
  name: string;
  sort_order?: number;
  color?: string | null;
};

export type TaskListUpdateInput = {
  id: number;
  name?: string;
  sort_order?: number;
  closed?: boolean;
  color?: string | null;
};

export type TaskItemRow = {
  id: number;
  title: string;
  status: TaskItemStatus;
  priority: TaskItemPriority;
  due_at: string | null;
  list_id: number;
  sort_order: number;
  note: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskItemCreateInput = {
  title: string;
  list_id: number;
  priority?: TaskItemPriority;
  due_at?: string | null;
  note?: string | null;
  sort_order?: number;
};

export type TaskItemUpdateInput = {
  id: number;
  title?: string;
  list_id?: number;
  priority?: TaskItemPriority;
  due_at?: string | null;
  note?: string | null;
  sort_order?: number;
  status?: TaskItemStatus;
};

export type TaskItemListOpts = {
  list_id?: number;
  status?: TaskItemStatus | "all";
  due_today?: boolean;
  limit?: number;
  offset?: number;
};
