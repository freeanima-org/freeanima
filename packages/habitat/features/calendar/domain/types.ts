export type CalendarSubjectKind = "user" | "agent";

export type CalendarEventRow = {
  id: number;
  title: string;
  content: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  remind_at: string | null;
  tag_ids: number[];
  created_at: string;
  updated_at: string;
};

export type CalendarEventCreateInput = {
  title: string;
  content?: string;
  start_at: string;
  end_at?: string | null;
  all_day?: boolean;
  remind_at?: string | null;
  tag_ids?: number[];
  client_op_id?: string;
};

export type CalendarEventUpdateInput = {
  id: number;
  title?: string;
  content?: string;
  start_at?: string;
  end_at?: string | null;
  all_day?: boolean;
  remind_at?: string | null;
  tag_ids?: number[];
};

export type CalendarEventListOpts = {
  range_start?: string;
  range_end?: string;
  limit?: number;
  offset?: number;
};

export type CalendarStoreContext = {
  worldId: number;
};

export type CalendarRangeKind = "event" | "task" | "project";

export type CalendarRangeEventItem = {
  kind: "event";
  id: number;
  title: string;
  content: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  remind_at: string | null;
};

export type CalendarRangeTaskItem = {
  kind: "task";
  id: number;
  title: string;
  /** 时段起点；无则与 due_at 相同语义 */
  start_at?: string | null;
  due_at: string;
  status: "pending" | "completed";
  priority: "high" | "medium" | "low" | "none";
  project_id: number | null;
  list_id: number | null;
  virtual?: boolean;
};

export type CalendarRangeProjectItem = {
  kind: "project";
  id: number;
  title: string;
  start_at: string | null;
  end_at: string | null;
  status: string;
};

export type CalendarRangeItem =
  | CalendarRangeEventItem
  | CalendarRangeTaskItem
  | CalendarRangeProjectItem;

export type CalendarRangeOpts = {
  from: string;
  to: string;
  kinds?: CalendarRangeKind[];
};
