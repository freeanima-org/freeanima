import { logCapability as logComponent } from "@freeanima/core/config";
import {
  parseCursorPlan,
  parseCursorQuestions,
  type CursorPendingPlan,
  type CursorPendingQuestions,
} from "../cursor-decision.ts";
import { permissionAllowOnce, parseSessionUpdateChunk } from "./generic.ts";
import type { AcpAgentAdapter, AcpServerRequestContext } from "./types.ts";

/** Cursor CLI `agent acp` — https://cursor.com/docs/cli/acp */
export const cursorAcpAdapter: AcpAgentAdapter = {
  id: "cursor",

  async afterInitialize(client) {
    try {
      await client.call("authenticate", { methodId: "cursor_login" });
    } catch (e) {
      logComponent("acp").warn("authenticate failed (agent login may be required)", { err: e });
    }
  },

  parseSessionUpdate: parseSessionUpdateChunk,

  handleServerRequest(method, params, ctx) {
    if (method === "session/request_permission") {
      return permissionAllowOnce(params);
    }
    if (method === "cursor/ask_question") {
      return handleAskQuestion(params, ctx);
    }
    if (method === "cursor/create_plan") {
      return handleCreatePlan(params, ctx);
    }
    if (method === "cursor/update_todos") {
      return { outcome: { outcome: "accepted", todos: params.todos ?? [] } };
    }
    if (method === "cursor/task") {
      return { outcome: { outcome: "completed" } };
    }
    if (method === "cursor/generate_image") {
      const filePath = params.filePath;
      return {
        outcome: {
          outcome: "generated",
          filePath: typeof filePath === "string" ? filePath : "",
        },
      };
    }
    return null;
  },
};

async function notifyDecisionNeeded(ctx: AcpServerRequestContext | undefined): Promise<void> {
  if (!ctx?.onDecisionNeeded || ctx.capture.pending.length === 0) return;
  await ctx.onDecisionNeeded([...ctx.capture.pending], [...ctx.capture.notes]);
}

function handleAskQuestion(
  params: Record<string, unknown>,
  ctx?: AcpServerRequestContext,
): Record<string, unknown> {
  const questions = parseCursorQuestions(params);
  if (questions.length === 0) {
    return { outcome: { outcome: "skipped", reason: "anima: no questions" } };
  }

  if (ctx) {
    const pending: CursorPendingQuestions = { kind: "questions", questions };
    ctx.capture.pending.push(pending);
    ctx.capture.notes.push(
      `Cursor asked ${questions.length} question(s) and paused awaiting a decision. Answer autonomously or call clarify to ask your partner, then continue via acp_cursor(acp_conversation_id=...) from the prior result.`,
    );
    void notifyDecisionNeeded(ctx);
  }

  return { outcome: { outcome: "skipped", reason: "anima:awaiting_decision" } };
}

function handleCreatePlan(
  params: Record<string, unknown>,
  ctx?: AcpServerRequestContext,
): Record<string, unknown> {
  const plan = parseCursorPlan(params);
  const planUri = typeof params.planUri === "string" ? params.planUri : undefined;

  if (ctx && plan) {
    const pending: CursorPendingPlan = {
      kind: "plan",
      plan,
      ...(planUri !== undefined ? { planUri } : {}),
    };
    ctx.capture.pending.push(pending);
    ctx.capture.notes.push(
      "Cursor submitted a plan awaiting approval. Review pending_plan in output, approve autonomously or verify via clarify, then continue with acp_conversation_id from the prior result.",
    );
    void notifyDecisionNeeded(ctx);
  }

  return { outcome: { outcome: "rejected", reason: "anima:awaiting_review" } };
}
