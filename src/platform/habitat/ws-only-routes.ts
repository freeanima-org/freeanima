import {
  toolErrorInputSchema,
  toolRegisterInputSchema,
  toolRegisterOutputSchema,
  toolResultInputSchema,
  toolUnregisterInputSchema,
} from "@freeanima/shared/rpc-contract/frames/tool";
import {
  terminalAttachInputSchema,
  terminalAttachOutputSchema,
  terminalCloseInputSchema,
  terminalResizeInputSchema,
  terminalWriteInputSchema,
} from "@freeanima/shared/rpc-contract/frames/terminal";
import {
  remoteToolsAttachOutputSchema,
  remoteToolsAttachPayloadSchema,
} from "@freeanima/shared/rpc-contract/frames/remote-tools-session";
import { wsOnlyMeta } from "@freeanima/shared/habitat-contract";
import {
  defineHabitatRoute,
  mergeFeatureRoutes,
} from "@freeanima/shared/habitat-contract/route.ts";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import { z } from "zod";

import type { RemoteToolsServerDeps } from "../remote-tools/types.ts";
import {
  closeTerminalSession,
  createTerminalSession,
  getTerminalSession,
  TerminalSessionError,
} from "../remote-tools/terminal-session.ts";

const okSchema = z.object({ ok: z.literal(true) });
const sapDetachInputSchema = z.object({}).strict();

function depsOf(deps: unknown): RemoteToolsServerDeps {
  return deps as RemoteToolsServerDeps;
}

function ctxOf(ctx: unknown): RemoteToolsRequestContext {
  return ctx as RemoteToolsRequestContext;
}

export const wsOnlyHabitatRoutes = mergeFeatureRoutes([
  defineHabitatRoute({
    method: "remote_tools.attach",
    input: remoteToolsAttachPayloadSchema,
    output: remoteToolsAttachOutputSchema,
    meta: wsOnlyMeta(),
    handler: async () => {
      throw new Error("remote_tools.attach is handled by Habitat RPC transport layer");
    },
  }),
  defineHabitatRoute({
    method: "remote_tools.detach",
    input: sapDetachInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
    handler: async () => {
      throw new Error("remote_tools.detach is handled by Habitat RPC transport layer");
    },
  }),
  defineHabitatRoute({
    method: "tool.register",
    input: toolRegisterInputSchema,
    output: toolRegisterOutputSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input, ctx) => {
      const sapCtx = ctxOf(ctx);
      const registered = depsOf(deps).remoteToolsManager.registerTools(
        sapCtx.app_id,
        sapCtx.instance_id,
        input.tools,
        { private: input.private },
      );
      return { registered };
    },
  }),
  defineHabitatRoute({
    method: "tool.unregister",
    input: toolUnregisterInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input, ctx) => {
      const sapCtx = ctxOf(ctx);
      depsOf(deps).remoteToolsManager.unregisterTools(
        sapCtx.app_id,
        sapCtx.instance_id,
        input.local_names,
      );
      return { ok: true as const };
    },
  }),
  defineHabitatRoute({
    method: "tool.result",
    input: toolResultInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input) => {
      depsOf(deps).remoteToolsManager.handleToolResult(input.call_id, input.content);
      return { ok: true as const };
    },
  }),
  defineHabitatRoute({
    method: "tool.error",
    input: toolErrorInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input) => {
      depsOf(deps).remoteToolsManager.handleToolError(input.call_id, input.error);
      return { ok: true as const };
    },
  }),
  defineHabitatRoute({
    method: "terminal.attach",
    input: terminalAttachInputSchema,
    output: terminalAttachOutputSchema,
    meta: wsOnlyMeta(),
    handler: async (_deps, input, ctx) => {
      const sapCtx = ctxOf(ctx);
      const { conversationId, pty } = createTerminalSession(input.cwd);
      pty.onData((data) => {
        sapCtx.sendEvent("terminal.output", { terminal_id: conversationId, data });
      });
      pty.onExit((code) => {
        sapCtx.sendEvent("terminal.exit", { terminal_id: conversationId, code });
        closeTerminalSession(conversationId);
      });
      sapCtx.sendEvent("terminal.ready", { terminal_id: conversationId, conversationId });
      return { terminal_id: conversationId };
    },
  }),
  defineHabitatRoute({
    method: "terminal.write",
    input: terminalWriteInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
    handler: async (_deps, input) => {
      const pty = getTerminalSession(input.terminal_id);
      if (!pty) throw new TerminalSessionError();
      pty.write(input.data);
      return { ok: true as const };
    },
  }),
  defineHabitatRoute({
    method: "terminal.resize",
    input: terminalResizeInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
    handler: async (_deps, input) => {
      const pty = getTerminalSession(input.terminal_id);
      if (!pty) throw new TerminalSessionError();
      pty.resize(input.cols, input.rows);
      return { ok: true as const };
    },
  }),
  defineHabitatRoute({
    method: "terminal.close",
    input: terminalCloseInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
    handler: async (_deps, input) => {
      closeTerminalSession(input.terminal_id);
      return { ok: true as const };
    },
  }),
]);
