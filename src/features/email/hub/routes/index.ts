import type { z } from "zod";

import {
  attachHandlersToDefs,
  type HubRouteHandler,
} from "@freeanima/shared/hub-contract/route.ts";
import { emailMethodDefs } from "@freeanima/shared/hub-contract/registry/features.ts";

import {
  handleEmailAccountList,
  handleEmailMessageList,
  handleEmailMessageMarkRead,
  handleEmailMessageRead,
  handleEmailMessageSearch,
  handleEmailSync,
  handleEmailThreadList,
} from "../rpc.ts";

export const emailHubRoutes = attachHandlersToDefs(emailMethodDefs, {
  "emailaccount.list": handleEmailAccountList,
  "email.message.list": handleEmailMessageList,
  "email.message.read": handleEmailMessageRead,
  "email.message.markRead": handleEmailMessageMarkRead,
  "email.message.search": handleEmailMessageSearch,
  "email.sync": handleEmailSync,
  "emailthread.list": handleEmailThreadList,
} as Record<keyof typeof emailMethodDefs, HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>>);
