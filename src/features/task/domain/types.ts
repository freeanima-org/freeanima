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
  client_op_id?: string;
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
  tag_ids?: number[];
  /** 任务模块必填；与 project_id 互斥 */
  list_id?: number | null;
  priority?: TaskItemPriority;
  due_at?: string | null;
  remind_at?: string | null;
  sort_order?: number;
  /** 项目内必填；与 list_id 互斥 */
  project_id?: number | null;
  client_op_id?: string;
};

export type TaskItemUpdateInput = {
  id: number;
  title?: string;
  content?: string;
  tag_ids?: number[];
  list_id?: number | null;
  project_id?: number | null;
  priority?: TaskItemPriority;
  due_at?: string | null;
  remind_at?: string | null;
  sort_order?: number;
  status?: "pending" | "completed";
};

export type TaskItemSearchOpts = {
  query: string;
  list_id?: number;
  project_id?: number;
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
  tag_ids?: number[];
  project_id?: number;
  in_backlog?: boolean;
  filters?: TaskItemSearchFilters;
  limit?: number;
  offset?: number;
};
