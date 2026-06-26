import type { TaskItemPriority } from "@freeanima/core/db/schema/entity";

export type TaskListRow = {
  id: number;
  name: string;
  sort_order: number;
  closed: boolean;
  color: string | null;
  is_default: boolean;
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
  content: string;
  tags: string[];
  status: "pending" | "completed";
  priority: TaskItemPriority;
  due_at: string | null;
  list_id: number;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskItemCreateInput = {
  title: string;
  content?: string;
  tags?: string[];
  list_id: number;
  priority?: TaskItemPriority;
  due_at?: string | null;
  sort_order?: number;
};

export type TaskItemUpdateInput = {
  id: number;
  title?: string;
  content?: string;
  tags?: string[];
  list_id?: number;
  priority?: TaskItemPriority;
  due_at?: string | null;
  sort_order?: number;
  status?: "pending" | "completed";
};

export type TaskItemListOpts = {
  list_id?: number;
  status?: "pending" | "completed" | "all";
  due_today?: boolean;
  tags?: string[];
  limit?: number;
  offset?: number;
};
