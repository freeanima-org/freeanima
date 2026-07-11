import { omitUndefined } from "@freeanima/core/util";
import { dualTransportMeta } from "@freeanima/shared/hub-contract";
import { defineHubRoute, mergeFeatureRoutes } from "@freeanima/shared/hub-contract/route.ts";
import {
  emailAccountListInputSchema,
  emailAccountListOutputSchema,
  emailMessageListInputSchema,
  emailMessageListOutputSchema,
  emailMessageMarkReadInputSchema,
  emailMessageMarkReadOutputSchema,
  emailMessageReadInputSchema,
  emailMessageReadOutputSchema,
  emailMessageSearchInputSchema,
  emailMessageSearchOutputSchema,
  emailSyncInputSchema,
  emailSyncOutputSchema,
  emailThreadListInputSchema,
  emailThreadListOutputSchema,
} from "@freeanima/shared/sap-contract/frames/email";

import type { RuntimeDeps } from "../runtime-deps.ts";
import * as service from "../service.ts";

type EmailSapServerDeps = {
  runtime: { runtimeDeps(): RuntimeDeps };
};

function depsOf(deps: unknown): EmailSapServerDeps {
  return deps as EmailSapServerDeps;
}

export const emailHubRoutes = mergeFeatureRoutes([
  defineHubRoute({
    method: "emailaccount.list",
    input: emailAccountListInputSchema,
    output: emailAccountListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.serviceEmailAccountList(depsOf(deps).runtime.runtimeDeps(), input),
  }),
  defineHubRoute({
    method: "email.message.list",
    input: emailMessageListInputSchema,
    output: emailMessageListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.serviceEmailMessageList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
  defineHubRoute({
    method: "email.message.read",
    input: emailMessageReadInputSchema,
    output: emailMessageReadOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.serviceEmailMessageRead(depsOf(deps).runtime.runtimeDeps(), input),
  }),
  defineHubRoute({
    method: "email.message.markRead",
    input: emailMessageMarkReadInputSchema,
    output: emailMessageMarkReadOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input) =>
      service.serviceEmailMessageMarkRead(depsOf(deps).runtime.runtimeDeps(), input),
  }),
  defineHubRoute({
    method: "email.message.search",
    input: emailMessageSearchInputSchema,
    output: emailMessageSearchOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.serviceEmailMessageSearch(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
  defineHubRoute({
    method: "email.sync",
    input: emailSyncInputSchema,
    output: emailSyncOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (deps, input) =>
      service.serviceEmailSync(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
  defineHubRoute({
    method: "emailthread.list",
    input: emailThreadListInputSchema,
    output: emailThreadListOutputSchema,
    meta: dualTransportMeta(true),
    handler: async (deps, input) =>
      service.serviceEmailThreadList(depsOf(deps).runtime.runtimeDeps(), omitUndefined(input)),
  }),
]);
