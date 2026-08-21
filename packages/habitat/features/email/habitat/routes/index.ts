import { omitUndefined } from "@freeanima/habitat/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import {
  bindHabitatRouteHandlers,
  asRouteDeps,
  asRouteCtx,
} from "@freeanima/shared/habitat-contract/route.ts";

import { handleEmailAttachmentUpload } from "../binary.ts";
import { emailMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type EmailRemoteToolsServerDeps = {
  runtime: { runtimeDeps(): RuntimeDeps };
};

function depsOf(deps: unknown): EmailRemoteToolsServerDeps {
  return asRouteDeps<EmailRemoteToolsServerDeps>(deps);
}

function ctxOf(ctx: unknown): RemoteToolsRequestContext {
  return asRouteCtx<RemoteToolsRequestContext>(ctx);
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
  "email.message.attachTask": async (deps, input) =>
    service.serviceEmailMessageAttachTask(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "email.message.detachTask": async (deps, input) =>
    service.serviceEmailMessageDetachTask(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.markRead": async (deps, input) =>
    service.serviceEmailMessageMarkRead(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.markUnread": async (deps, input) =>
    service.serviceEmailMessageMarkUnread(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.delete": async (deps, input) =>
    service.serviceEmailMessageDelete(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.move": async (deps, input) =>
    service.serviceEmailMessageMove(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.markFlagged": async (deps, input) =>
    service.serviceEmailMessageMarkFlagged(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.markUnflagged": async (deps, input) =>
    service.serviceEmailMessageMarkUnflagged(depsOf(deps).runtime.runtimeDeps(), input),
  "email.message.search": async (deps, input) =>
    service.serviceEmailMessageSearch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "email.send": async (deps, input) =>
    service.serviceEmailSend(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "email.attachment.upload": async (_deps, input, ctx) =>
    handleEmailAttachmentUpload(_deps, input, ctxOf(ctx)),
  "email.sync": async (deps, input) =>
    service.serviceEmailSync(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "email.mailbox.list": async (deps, input) =>
    service.serviceEmailMailboxList(depsOf(deps).runtime.runtimeDeps(), input),
  "email.mailbox.create": async (deps, input) =>
    service.serviceEmailMailboxCreate(depsOf(deps).runtime.runtimeDeps(), input),
  "email.mailbox.rename": async (deps, input) =>
    service.serviceEmailMailboxRename(depsOf(deps).runtime.runtimeDeps(), input),
  "email.mailbox.delete": async (deps, input) =>
    service.serviceEmailMailboxDelete(depsOf(deps).runtime.runtimeDeps(), input),
  "email.draft.save": async (deps, input) =>
    service.serviceEmailDraftSave(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  "email.draft.send": async (deps, input) =>
    service.serviceEmailDraftSend(depsOf(deps).runtime.runtimeDeps(), input),
  "emailthread.list": async (deps, input) =>
    service.serviceEmailThreadList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
});
