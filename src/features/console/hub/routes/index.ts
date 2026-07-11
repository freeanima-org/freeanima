import type { z } from "zod";

import {
  attachHandlersToDefs,
  type HubRouteHandler,
} from "@freeanima/shared/hub-contract/route.ts";
import { consoleMethodDefs } from "@freeanima/shared/hub-contract/registry/console.ts";

import type { SapRequestContext } from "@freeanima/shared/sap-contract";

import { consoleHubHandlers } from "../console-api/console-hub-handlers.ts";
import { searchEntities } from "../console-api/handlers/entities.ts";
import { tokensHubHandlers } from "../console-api/handlers/service-api-tokens.ts";
import { consolePublicHubHandlers } from "../public-handlers.ts";
import { handleTtsSynthesize } from "../tts-handler.ts";

/** chat plugin 已注册的 method，console routes 中排除 */
const CHAT_HUB_RPC_METHODS = new Set([
  "conversation.create",
  "conversation.list",
  "conversation.messages",
  "conversation.patchTitle",
  "conversation.archive",
  "conversation.unarchive",
  "conversation.delete",
  "conversation.rollbackBeforeLastUser",
  "conversation.subscribe",
  "conversation.acpDock",
  "conversation.commands",
  "message.send",
  "message.interrupt",
]);

type AnyHubRouteHandler = HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>;

const entitySearchHandler: AnyHubRouteHandler = (_deps, input, ctx) =>
  searchEntities(
    input as Parameters<typeof searchEntities>[0],
    (ctx as SapRequestContext).auth ?? null,
  );

function wrapConsoleLegacyHandler(
  fn: (payload: unknown) => Promise<unknown> | unknown,
): AnyHubRouteHandler {
  return (_deps: unknown, input: unknown, _ctx: unknown) => Promise.resolve(fn(input));
}

function buildConsoleRouteHandlers(): Record<keyof typeof consoleMethodDefs, AnyHubRouteHandler> {
  const handlers = {
    ...consolePublicHubHandlers,
    ...tokensHubHandlers,
    "tts.synthesize": handleTtsSynthesize,
  } as Record<string, AnyHubRouteHandler>;

  for (const [method, fn] of Object.entries(consoleHubHandlers)) {
    if (CHAT_HUB_RPC_METHODS.has(method)) continue;
    if (method in consolePublicHubHandlers) continue;
    if (method === "entity.searchGet" || method === "entity.searchPost") continue;
    handlers[method] = wrapConsoleLegacyHandler(
      fn as (payload: unknown) => Promise<unknown> | unknown,
    );
  }

  handlers["entity.searchGet"] = entitySearchHandler;
  handlers["entity.searchPost"] = entitySearchHandler;

  return handlers as Record<keyof typeof consoleMethodDefs, AnyHubRouteHandler>;
}

export const consoleHubRoutes = attachHandlersToDefs(
  consoleMethodDefs,
  buildConsoleRouteHandlers(),
);
