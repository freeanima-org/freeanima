/// <reference lib="dom" />
import { getSubjectKind } from "@freeanima/frontend/shell-sdk/subject-scope-store.ts";
import { getSatelliteHubClient } from "@freeanima/shared/hub-client";

export type TaskPomodoroFocusRow = {
  id: number;
  pomodoro_session_id: number | null;
  started_at: string;
  ended_at: string;
  duration_ms: number;
};

function hub() {
  return getSatelliteHubClient();
}

export async function fetchTaskPomodoroFocus(
  taskItemId: number,
  limit = 10,
): Promise<TaskPomodoroFocusRow[]> {
  const data = await hub().call("pomodoro.focus.list", {
    subject_kind: getSubjectKind(),
    task_item_id: taskItemId,
    limit,
  });
  return (data.items ?? []).map((item: TaskPomodoroFocusRow) => item);
}
