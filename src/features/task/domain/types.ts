import type { TaskItemPriority } from "@freeanima/host/core/db/schema/entity";
import type { TaskItemSearchFilters } from "@freeanima/host/core/db/schema";
import type {
  TaskRecurrence,
  TaskRecurrenceInput,
} from "@freeanima/host/core/db/schema/entity/task-recurrence.ts";

export type {
  TaskItemRowPayload as TaskItemRow,
  TaskListRowPayload as TaskListRow,
} from "@freeanima/shared/rpc-contract";

export type { SmartListRowPayload as SmartListRow } from "@freeanima/shared/rpc-contract/frames/task.ts";

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
  recurrence?: TaskRecurrenceInput | null | undefined;
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
  recurrence?: TaskRecurrenceInput | TaskRecurrence | null | undefined;
  /**
   * 仅当有 recurrence 且改 due_at 时：true = 仅此一次（不改 schedule_at）；
   * false/缺省 = 同时改规则轨 schedule_at。
   */
  only_this?: boolean;
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
