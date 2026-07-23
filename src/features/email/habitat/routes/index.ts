import { omitUndefined } from "@freeanima/core/util";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { emailMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type EmailRemoteToolsServerDeps = {
  runtime: { runtimeDeps(): RuntimeDeps };
};

function depsOf(deps: unknown): EmailRemoteToolsServerDeps {
  return deps as EmailRemoteToolsServerDeps;
}

export const emailHabitatRoutes = bindHabitatRouteHandlers(emailMethodDefs, {
  "emailaccount.list": async (deps, input) =>
    service.serviceEmailAccountList(depsOf(deps).runtime.runtimeDeps(), input),
  "emailaccount.create": async (deps, input) =>
    service.serviceEmailAccountCreate(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "emailaccount.patch": async (deps, input) =>
    service.serviceEmailAccountPatch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "emailaccount.delete": async (deps, input) =>
    service.serviceEmailAccountDelete(depsOf(deps).runtime.runtimeDeps(), input),
  "emailprovider.list": async (deps) =>
    service.serviceEmailProviderList(depsOf(deps).runtime.runtimeDeps()),
  "email.message.list": async (deps, input) =>
    service.serviceEmailMessageList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "email.message.read": async (deps, input) =>
    service.serviceEmailMessageRead(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "email.message.markRead": async (deps, input) =>
    service.serviceEmailMessageMarkRead(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.markUnread": async (deps, input) =>
    service.serviceEmailMessageMarkUnread(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.delete": async (deps, input) =>
    service.serviceEmailMessageDelete(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.search": async (deps, input) =>
    service.serviceEmailMessageSearch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "email.send": async (deps, input) =>
    service.serviceEmailSend(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "email.sync": async (deps, input) =>
    service.serviceEmailSync(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "emailthread.list": async (deps, input) =>
    service.serviceEmailThreadList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
});
