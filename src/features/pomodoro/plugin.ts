import {
  handlePomodoroConfigGet,
  handlePomodoroConfigUpdate,
  handlePomodoroFocusList,
  handlePomodoroSessionAbort,
  handlePomodoroSessionComplete,
  handlePomodoroSessionList,
  handlePomodoroSessionStats,
  handlePomodoroActiveGet,
  handlePomodoroActivePut,
  handlePomodoroActiveClear,
} from "./hub/rpc.ts";

/** Pomodoro feature plugin — registered by platform at boot. */
export const pomodoroPlugin = {
  id: "pomodoro",
  shell: {
    routes: [{ path: "/pomodoro", featureId: "pomodoro", navLabel: "Pomodoro" }],
  },
  hub: {
    rpc: {
      "pomodoro.config.get": handlePomodoroConfigGet,
      "pomodoro.config.update": handlePomodoroConfigUpdate,
      "pomodoro.session.complete": handlePomodoroSessionComplete,
      "pomodoro.session.abort": handlePomodoroSessionAbort,
      "pomodoro.session.list": handlePomodoroSessionList,
      "pomodoro.session.stats": handlePomodoroSessionStats,
      "pomodoro.focus.list": handlePomodoroFocusList,
      "pomodoro.active.get": handlePomodoroActiveGet,
      "pomodoro.active.put": handlePomodoroActivePut,
      "pomodoro.active.clear": handlePomodoroActiveClear,
    },
  },
} as const;
