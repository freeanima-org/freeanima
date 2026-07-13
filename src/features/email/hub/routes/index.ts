import { omitUndefined } from "@freeanima/core/util";
import { bindHubRouteHandlers } from "@freeanima/shared/hub-contract/route.ts";

import { emailMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type EmailSapServerDeps = {
  runtime: { runtimeDeps(): RuntimeDeps };
};

function depsOf(deps: unknown): EmailSapServerDeps {
  return deps as EmailSapServerDeps;
}

export const emailHubRoutes = bindHubRouteHandlers(emailMethodDefs, {
  "emailaccount.list": async (deps, input) =>
    service.serviceEmailAccountList(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.list": async (deps, input) =>
    service.serviceEmailMessageList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "email.message.read": async (deps, input) =>
    service.serviceEmailMessageRead(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.markRead": async (deps, input) =>
    service.serviceEmailMessageMarkRead(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.search": async (deps, input) =>
    service.serviceEmailMessageSearch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "email.sync": async (deps, input) =>
    service.serviceEmailSync(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "emailthread.list": async (deps, input) =>
    service.serviceEmailThreadList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
});
