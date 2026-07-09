import { readPomodoroActiveState, switchPomodoroActiveTask } from "./pomodoro-active.ts";
import { navigateShellModulePath } from "./pomodoro-launch.ts";

export type PomodoroTaskLaunchInput = {
  id: number;
  title?: string;
};

/** 从任务发起番茄钟：有活跃计时则仅切换关联任务，否则跳转并自动开始。 */
export function launchPomodoroForTask(task: PomodoroTaskLaunchInput): void {
  const params = new URLSearchParams({ taskId: String(task.id) });
  const active = readPomodoroActiveState();
  if (active) {
    switchPomodoroActiveTask(task.id);
    navigateShellModulePath(`/pomodoro?${params}`);
    return;
  }
  params.set("autostart", "1");
  navigateShellModulePath(`/pomodoro?${params}`);
}
