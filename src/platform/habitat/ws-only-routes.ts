import {
  toolErrorInputSchema,
  toolRegisterInputSchema,
  toolRegisterOutputSchema,
  toolResultInputSchema,
  toolUnregisterInputSchema,
} from "@freeanima/shared/sap-contract/frames/tool";
import {
  terminalAttachInputSchema,
  terminalAttachOutputSchema,
  terminalCloseInputSchema,
  terminalResizeInputSchema,
  terminalWriteInputSchema,
} from "@freeanima/shared/sap-contract/frames/terminal";
import {
  sapAttachOutputSchema,
  sapAttachPayloadSchema,
} from "@freeanima/shared/sap-contract/frames/sap-session";
import { wsOnlyMeta } from "@freeanima/shared/habitat-contract";
import { defineHubRoute, mergeFeatureRoutes } from "@freeanima/shared/habitat-contract/route.ts";
import type { SapRequestContext } from "@freeanima/shared/sap-contract";
import { z } from "zod";

import type { SapServerDeps } from "../sap/types.ts";
import {
  closeTerminalSession,
  createTerminalSession,
  getTerminalSession,
  TerminalSessionError,
} from "../sap/terminal-session.ts";

const okSchema = z.object({ ok: z.literal(true) });
const sapDetachInputSchema = z.object({}).strict();

function depsOf(deps: unknown): SapServerDeps {
  return deps as SapServerDeps;
}

function ctxOf(ctx: unknown): SapRequestContext {
  return ctx as SapRequestContext;
}

export const wsOnlyHubRoutes = mergeFeatureRoutes([
  defineHubRoute({
    method: "sap.attach",
    input: sapAttachPayloadSchema,
    output: sapAttachOutputSchema,
    meta: wsOnlyMeta(),
    handler: async () => {
      throw new Error("sap.attach is handled by Habitat RPC transport layer");
    },
  }),
  defineHubRoute({
    method: "sap.detach",
    input: sapDetachInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
    handler: async () => {
      throw new Error("sap.detach is handled by Habitat RPC transport layer");
    },
  }),
  defineHubRoute({
    method: "tool.register",
    input: toolRegisterInputSchema,
    output: toolRegisterOutputSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input, ctx) => {
      const sapCtx = ctxOf(ctx);
      const registered = depsOf(deps).satelliteManager.registerTools(
        sapCtx.app_id,
        sapCtx.instance_id,
        input.tools,
        { private: input.private },
      );
      return { registered };
    },
  }),
  defineHubRoute({
    method: "tool.unregister",
    input: toolUnregisterInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input, ctx) => {
      const sapCtx = ctxOf(ctx);
      depsOf(deps).satelliteManager.unregisterTools(
        sapCtx.app_id,
        sapCtx.instance_id,
        input.local_names,
      );
      return { ok: true as const };
    },
  }),
  defineHubRoute({
    method: "tool.result",
    input: toolResultInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input) => {
      depsOf(deps).satelliteManager.handleToolResult(input.call_id, input.content);
      return { ok: true as const };
    },
  }),
  defineHubRoute({
    method: "tool.error",
    input: toolErrorInputSchema,
    output: okSchema,
    meta: wsOnlyMeta(),
    handler: async (deps, input) => {
      depsOf(deps).satelliteManager.handleToolError(input.call_id, input.error);
      return { ok: true as const };
    },
  }),
  defineHubRoute({
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
  defineHubRoute({
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
  defineHubRoute({
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
  defineHubRoute({
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
