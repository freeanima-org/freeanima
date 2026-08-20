import { omitUndefined } from "@freeanima/habitat/core/util";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { bindHabitatRouteHandlers } from "@freeanima/shared/habitat-contract/route.ts";

import { contactMethodDefs } from "../method-defs.ts";
import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type ContactRemoteToolsServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

function depsOf(deps: unknown): ContactRemoteToolsServerDeps {
  return deps as ContactRemoteToolsServerDeps;
}

function ctxAuth(ctx: unknown) {
  return (ctx as RemoteToolsRequestContext).auth;
}

export const contactHabitatRoutes = bindHabitatRouteHandlers(contactMethodDefs, {
  "contact.list": async (deps, input, ctx) =>
    service.serviceContactList(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "contact.get": async (deps, input, ctx) =>
    service.serviceContactGet(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  "contact.search": async (deps, input, ctx) =>
    service.serviceContactSearch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "contact.create": async (deps, input, ctx) =>
    service.serviceContactCreate(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "contact.patch": async (deps, input, ctx) =>
    service.serviceContactPatch(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "contact.delete": async (deps, input, ctx) =>
    service.serviceContactDelete(depsOf(deps).runtime.runtimeDeps(), input, ctxAuth(ctx)),
  "contact.resolveByAddress": async (deps, input, ctx) =>
    service.serviceContactResolveByAddress(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "contact.attachAddress": async (deps, input, ctx) =>
    service.serviceContactAttachAddress(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "contact.createFromAddress": async (deps, input, ctx) =>
    service.serviceContactCreateFromAddress(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
  "contact.linkMessage": async (deps, input, ctx) =>
    service.serviceContactLinkMessage(
      depsOf(deps).runtime.runtimeDeps(),
      omitUndefined(input),
      ctxAuth(ctx),
    ),
});
