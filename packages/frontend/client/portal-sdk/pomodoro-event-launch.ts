import { readPomodoroActiveState, writePomodoroActiveState } from "./pomodoro-active.ts";
import { switchWorkFocusLink } from "./pomodoro-focus-segments.ts";
import { navigateAppModulePath } from "./pomodoro-launch.ts";

export type PomodoroEventLaunchInput = {
  id: number;
  title?: string;
};

/** 从日历事件发起番茄钟：有活跃计时则仅切换关联事件，否则跳转并自动开始。 */
export function launchPomodoroForEvent(event: PomodoroEventLaunchInput): void {
  const params = new URLSearchParams({ eventId: String(event.id) });
  const active = readPomodoroActiveState();
  if (active) {
    writePomodoroActiveState(
      switchWorkFocusLink(active, { taskItemId: null, calendarEventId: event.id }),
    );
    navigateAppModulePath(`/pomodoro?${params}`);
    return;
  }
  params.set("autostart", "1");
  navigateAppModulePath(`/pomodoro?${params}`);
}
