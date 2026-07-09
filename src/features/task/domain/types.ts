import type { TaskItemPriority } from "@freeanima/core/db/schema/entity";
import type { TaskItemSearchFilters } from "@freeanima/core/db/schema";

export type {
  TaskItemRowPayload as TaskItemRow,
  TaskListRowPayload as TaskListRow,
} from "@freeanima/shared/sap-contract";

export type { SmartListRowPayload as SmartListRow } from "@freeanima/shared/sap-contract/frames/task.ts";

export type TaskListCreateInput = {
  name: string;
  sort_order?: number;
  color?: string | null;
  is_folder?: boolean;
  parent_id?: number | null;
};

export type TaskListUpdateInput = {
  id: number;
  name?: string;
  sort_order?: number;
  closed?: boolean;
  color?: string | null;
  is_folder?: boolean;
  parent_id?: number | null;
};

export type TaskItemCreateInput = {
  title: string;
  content?: string;
  tags?: string[];
  list_id: number;
  priority?: TaskItemPriority;
  due_at?: string | null;
  remind_at?: string | null;
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
  remind_at?: string | null;
  sort_order?: number;
  status?: "pending" | "completed";
};

export type TaskItemSearchOpts = {
  query: string;
  list_id?: number;
  status?: "pending" | "completed" | "all";
  limit?: number;
};

export type TaskListListOpts = {
  includeClosed?: boolean;
};

export type TaskListSearchOpts = {
  query: string;
  limit?: number;
  includeClosed?: boolean;
};

export type TaskItemListOpts = {
  list_id?: number;
  status?: "pending" | "completed" | "all";
  due_today?: boolean;
  tags?: string[];
  filters?: TaskItemSearchFilters;
  limit?: number;
  offset?: number;
};
