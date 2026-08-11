import { omitUndefined } from "@freeanima/host/core/util";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { calendarMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type CalendarRemoteToolsServerDeps = {
  runtime: { runtimeDeps(): RuntimeDeps };
};

function depsOf(deps: unknown): CalendarRemoteToolsServerDeps {
  return deps as CalendarRemoteToolsServerDeps;
}

export const calendarHabitatRoutes = bindHabitatRouteHandlers(calendarMethodDefs, {
  "calendar.list": async (deps, input) =>
    service.serviceCalendarList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "calendar.create": async (deps, input) =>
    service.serviceCalendarCreate(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "calendar.patch": async (deps, input) =>
    service.serviceCalendarPatch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "calendar.delete": async (deps, input) =>
    service.serviceCalendarDelete(depsOf(deps).runtime.runtimeDeps(), input),
  "calendar.get": async (deps, input) =>
    service.serviceCalendarGet(depsOf(deps).runtime.runtimeDeps(), input),
  "calendar.convertToTask": async (deps, input) =>
    service.serviceCalendarConvertToTask(depsOf(deps).runtime.runtimeDeps(), input),
  "calendar.range": async (deps, input) =>
    service.serviceCalendarRange(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
});
