export type CalendarSubjectKind = "user" | "agent";

export type CalendarReminderEntry = {
  at: string;
  anchor?: "start" | "end" | "due";
  last_notified_at?: string | null;
};

export type CalendarEventRow = {
  id: number;
  title: string;
  content: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  remind_at: string | null;
  reminders?: CalendarReminderEntry[];
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
  reminders?: CalendarReminderEntry[];
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
  reminders?: CalendarReminderEntry[];
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

export type CalendarRangeKind = "event" | "task" | "project" | "holiday" | "habit";

export type BuiltinCalendarSourceId = "cn_holiday" | "traditional" | "international" | "solar_term";

export type CalendarRangeEventItem = {
  kind: "event";
  id: number;
  title: string;
  content: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  remind_at: string | null;
  reminders?: CalendarReminderEntry[];
};

export type CalendarRangeTaskItem = {
  kind: "task";
  id: number;
  title: string;
  /** 计划开始 */
  start_at?: string | null;
  /** 计划结束；单点时为 null */
  end_at?: string | null;
  /** 截止（deadline），与计划独立 */
  due_at?: string | null;
  status: "pending" | "completed";
  priority: "high" | "medium" | "low" | "none";
  project_id: number | null;
  list_id: number | null;
  virtual?: boolean;
  completed_at?: string | null;
  occurrence_id?: number;
};

export type CalendarRangeProjectItem = {
  kind: "project";
  id: number;
  title: string;
  start_at: string | null;
  end_at: string | null;
  status: string;
};

export type CalendarRangeHolidayItem = {
  kind: "holiday";
  id: string;
  source: BuiltinCalendarSourceId;
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: true;
};

export type CalendarRangeHabitItem = {
  kind: "habit";
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  day: string;
  amount: number;
  target: number;
  met: boolean;
  polarity: "build" | "break";
  check_in_id: number | null;
  reminder_time?: string | null;
};

export type CalendarRangeItem =
  | CalendarRangeEventItem
  | CalendarRangeTaskItem
  | CalendarRangeProjectItem
  | CalendarRangeHolidayItem
  | CalendarRangeHabitItem;

export type CalendarRangeOpts = {
  from: string;
  to: string;
  kinds?: CalendarRangeKind[];
  /** kinds 含 holiday 时有效；缺省全部内置源 */
  sources?: BuiltinCalendarSourceId[];
  include_completed?: boolean;
};
