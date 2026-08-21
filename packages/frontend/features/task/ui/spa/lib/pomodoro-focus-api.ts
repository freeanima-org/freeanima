/// <reference lib="dom" />
import { getUserSubjectId } from "@freeanima/client/portal-sdk/world-context.ts";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

export type TaskPomodoroFocusRow = {
  id: number;
  pomodoro_session_id: number | null;
  started_at: string;
  ended_at: string;
  duration_ms: number;
};

function habitat() {
  return getTypedHabitatClient();
}

export async function fetchTaskPomodoroFocus(
  taskItemId: number,
  limit = 10,
): Promise<TaskPomodoroFocusRow[]> {
  const data = await habitat().call("pomodoro.focus.list", {
    subject_id: await getUserSubjectId(),
    task_item_id: taskItemId,
    limit,
  });
  return (data.items ?? []).map((item: TaskPomodoroFocusRow) => item);
}
