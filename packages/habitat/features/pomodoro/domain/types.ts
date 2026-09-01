import type { notificationRecipientKindSchema } from "@freeanima/shared/rpc-contract/frames/notification";
import type { z } from "zod";

import type {
  PomodoroPhase,
  PomodoroConfigBody,
  PomodoroSessionBody,
} from "@freeanima/habitat/core/db/schema/entity";

export type PomodoroSubjectKind = z.infer<typeof notificationRecipientKindSchema>;

export type PomodoroStoreContext = {
  worldId: number;
};

export type PomodoroConfigRow = PomodoroConfigBody;

export type PomodoroSessionRow = PomodoroSessionBody & {
  id: number;
  title: string;
  client_op_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PomodoroSessionListOpts = {
  started_after?: string;
  started_before?: string;
  phase?: PomodoroPhase;
  limit?: number;
  offset?: number;
};

export type PomodoroSessionWriteInput = {
  phase: PomodoroPhase;
  started_at: string;
  finished_at: string;
  planned_duration_ms: number;
  actual_duration_ms: number;
  task_item_id?: number | null;
  calendar_event_id?: number | null;
  cycle_index?: number;
  interrupted?: boolean;
  title?: string;
  session_local_id?: string;
  client_op_id?: string;
  task_focus_segments?: PomodoroTaskFocusWriteInput[];
};

export type PomodoroTaskFocusWriteInput = {
  session_local_id: string;
  phase: PomodoroPhase;
  phase_started_at: string;
  task_item_id?: number | null;
  calendar_event_id?: number | null;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  cycle_index?: number;
};

export type PomodoroTaskFocusRow = {
  id: number;
  session_local_id: string;
  pomodoro_session_id: number | null;
  phase: PomodoroPhase;
  phase_started_at: string;
  task_item_id: number | null;
  calendar_event_id: number | null;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  cycle_index: number;
  created_at: string;
  updated_at: string;
};

export type PomodoroStatsPeriod = "today" | "week";

export type PomodoroStats = {
  completed_work_sessions: number;
  total_focus_minutes: number;
  interrupted_count: number;
};
