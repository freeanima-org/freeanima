import { omitUndefined } from "@freeanima/core/util";
import { bindHubRouteHandlers } from "@freeanima/shared/hub-contract/route.ts";

import { pomodoroMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type PomodoroSapServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): PomodoroSapServerDeps {
  return deps as PomodoroSapServerDeps;
}

export const pomodoroHubRoutes = bindHubRouteHandlers(pomodoroMethodDefs, {
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
  "pomodoro.active.put": async (deps, input) =>
    service.servicePomodoroActivePut(depsOf(deps).runtime.runtimeDeps(), input),
  "pomodoro.active.clear": async (deps, input) =>
    service.servicePomodoroActiveClear(depsOf(deps).runtime.runtimeDeps(), input),
});
