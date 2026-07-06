import { omitUndefined } from "@freeanima/core/util";
import {
  emailAccountListInputSchema,
  emailMessageListInputSchema,
  emailMessageReadInputSchema,
  emailMessageMarkReadInputSchema,
  emailMessageSearchInputSchema,
  emailSyncInputSchema,
  emailThreadListInputSchema,
  type SapRequestContext,
} from "../protocol/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import * as serviceEntityEmail from "./service.ts";

/** Minimal SAP server deps for email handlers (structural superset: platform SapServerDeps). */
export type EmailSapServerDeps = {
  runtime: {
    runtimeDeps(): RuntimeDeps;
  };
};

export async function handleEmailAccountList(
  deps: EmailSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = emailAccountListInputSchema.parse(payload ?? {});
  return serviceEntityEmail.serviceEmailAccountList(deps.runtime.runtimeDeps(), input);
}

export async function handleEmailMessageList(
  deps: EmailSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = emailMessageListInputSchema.parse(payload);
  return serviceEntityEmail.serviceEmailMessageList(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
  );
}

export async function handleEmailMessageRead(
  deps: EmailSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = emailMessageReadInputSchema.parse(payload);
  return serviceEntityEmail.serviceEmailMessageRead(deps.runtime.runtimeDeps(), input);
}

export async function handleEmailMessageMarkRead(
  deps: EmailSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = emailMessageMarkReadInputSchema.parse(payload);
  return serviceEntityEmail.serviceEmailMessageMarkRead(deps.runtime.runtimeDeps(), input);
}

export async function handleEmailMessageSearch(
  deps: EmailSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = emailMessageSearchInputSchema.parse(payload);
  return serviceEntityEmail.serviceEmailMessageSearch(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
  );
}

export async function handleEmailSync(
  deps: EmailSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = emailSyncInputSchema.parse(payload);
  return serviceEntityEmail.serviceEmailSync(deps.runtime.runtimeDeps(), omitUndefined(input));
}

export async function handleEmailThreadList(
  deps: EmailSapServerDeps,
  payload: unknown,
  _ctx: SapRequestContext,
) {
  const input = emailThreadListInputSchema.parse(payload);
  return serviceEntityEmail.serviceEmailThreadList(
    deps.runtime.runtimeDeps(),
    omitUndefined(input),
  );
}
