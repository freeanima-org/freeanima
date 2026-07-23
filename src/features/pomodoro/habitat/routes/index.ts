import { omitUndefined } from "@freeanima/core/util";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";
import {
  POMODORO_ACTIVE_CHANGED_EVENT,
  type PomodoroActiveChangedEvent,
} from "@freeanima/shared/rpc-contract/frames/pomodoro";
import type { RemoteToolsServerDeps } from "@freeanima/platform/remote-tools/types";

import { pomodoroMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type PomodoroRemoteToolsServerDeps = RemoteToolsServerDeps & {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): PomodoroRemoteToolsServerDeps {
  return deps as PomodoroRemoteToolsServerDeps;
}

function broadcastActiveChanged(
  deps: PomodoroRemoteToolsServerDeps,
  event: PomodoroActiveChangedEvent,
): void {
  deps.hubSessionRegistry.broadcastToSubject(
    event.subject_kind,
    POMODORO_ACTIVE_CHANGED_EVENT,
    event,
  );
}

export const pomodoroHabitatRoutes = bindHabitatRouteHandlers(pomodoroMethodDefs, {
  "pomodoro.config.get": async (deps, input) =>
    service.servicePomodoroConfigGet(depsOf(deps).runtime.runtimeDeps(), input),
  "pomodoro.config.update": async (deps, input) =>
    service.servicePomodoroConfigUpdate(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "pomodoro.session.complete": async (deps, input) =>
    service.servicePomodoroSessionComplete(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
    ),
  "pomodoro.session.abort": async (deps, input) =>
    service.servicePomodoroSessionAbort(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "pomodoro.session.list": async (deps, input) =>
    service.servicePomodoroSessionList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "pomodoro.session.stats": async (deps, input) =>
    service.servicePomodoroSessionStats(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "pomodoro.focus.list": async (deps, input) =>
    service.servicePomodoroFocusList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "pomodoro.active.get": async (deps, input) =>
    service.servicePomodoroActiveGet(depsOf(deps).runtime.runtimeDeps(), input),
  "pomodoro.active.put": async (deps, input) => {
    const d = depsOf(deps);
    const result = await service.servicePomodoroActivePut(d.runtime.runtimeDeps(), input);
    broadcastActiveChanged(d, {
      subject_kind: input.subject_kind,
      active: result.active,
    });
    return result;
  },
  "pomodoro.active.clear": async (deps, input) => {
    const d = depsOf(deps);
    const result = await service.servicePomodoroActiveClear(d.runtime.runtimeDeps(), input);
    broadcastActiveChanged(d, {
      subject_kind: input.subject_kind,
      active: null,
    });
    return result;
  },
});
