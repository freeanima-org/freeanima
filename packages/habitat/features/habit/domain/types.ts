import type {
  HabitBody,
  HabitCheckInBody,
  HabitDaySection,
  HabitFrequency,
  HabitMood,
  HabitPolarity,
  HabitRecordMode,
  HabitReminder,
  HabitStatus,
  HabitCheckInStyle,
} from "@freeanima/habitat/core/db/schema/entity";

export type HabitRow = {
  id: number;
  title: string;
  content: string;
  polarity: HabitPolarity;
  record_mode: HabitRecordMode;
  target: number;
  unit: string | null;
  auto_amount: number | null;
  frequency: HabitFrequency;
  day_section: HabitDaySection;
  reminders: HabitReminder[];
  enable_journal: boolean;
  check_in_style: HabitCheckInStyle;
  status: HabitStatus;
  sort_order: number;
  color?: string | null;
  icon?: string | null;
  today_amount?: number;
  today_met?: boolean;
  today_check_in_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type HabitCheckInRow = {
  id: number;
  habit_id: number;
  day: string;
  amount: number;
  mood: HabitMood | null;
  note: string | null;
  checked_at: string;
  created_at: string;
  updated_at: string;
};

export type HabitDayCell = {
  day: string;
  amount: number;
  met: boolean;
  check_in_id: number | null;
};

export type HabitStats = {
  habit_id: number;
  total_met_days: number;
  current_streak: number;
  best_streak: number;
  month_met_days: number;
  month_cells: HabitDayCell[];
};

export type HabitPreset = {
  key: string;
  title: string;
  polarity: HabitPolarity;
  record_mode: HabitRecordMode;
  target: number;
  unit: string | null;
  auto_amount: number | null;
  day_section: HabitDaySection;
  icon: string | null;
};

export type HabitListOpts = {
  status?: HabitStatus;
  include_today?: boolean;
};

export type HabitCreateInput = {
  title: string;
  content?: string;
  polarity?: HabitPolarity;
  record_mode?: HabitRecordMode;
  target?: number;
  unit?: string | null;
  auto_amount?: number | null;
  frequency?: HabitFrequency;
  day_section?: HabitDaySection;
  reminders?: HabitReminder[];
  enable_journal?: boolean;
  check_in_style?: HabitCheckInStyle;
  sort_order?: number;
  color?: string | null;
  icon?: string | null;
  client_op_id?: string;
};

export type HabitUpdateInput = {
  id: number;
  title?: string;
  content?: string;
  polarity?: HabitPolarity;
  record_mode?: HabitRecordMode;
  target?: number;
  unit?: string | null;
  auto_amount?: number | null;
  frequency?: HabitFrequency;
  day_section?: HabitDaySection;
  reminders?: HabitReminder[];
  enable_journal?: boolean;
  check_in_style?: HabitCheckInStyle;
  sort_order?: number;
  color?: string | null;
  icon?: string | null;
  status?: HabitStatus;
};

export type HabitCheckInInput = {
  habit_id: number;
  day?: string;
  amount_delta?: number;
  amount?: number;
  mood?: HabitMood | null;
  note?: string | null;
};

export type HabitBodyFields = HabitBody;
export type HabitCheckInBodyFields = HabitCheckInBody;
