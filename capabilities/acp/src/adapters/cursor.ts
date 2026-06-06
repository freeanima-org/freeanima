import { logComponent } from "@freeanima/service-logging";
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
      logComponent("acp").warn("authenticate failed (可能需要 agent login)", { err: e });
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

function handleAskQuestion(
  params: Record<string, unknown>,
  ctx?: AcpServerRequestContext,
): Record<string, unknown> {
  const questions = parseCursorQuestions(params);
  if (!questions.length) {
    return { outcome: { outcome: "skipped", reason: "anima: no questions" } };
  }

  if (ctx) {
    const pending: CursorPendingQuestions = { kind: "questions", questions };
    ctx.capture.pending.push(pending);
    ctx.capture.notes.push(
      `Cursor 提出问题（${questions.length} 个），已暂停等待决策。请自主回答或调用 clarify 询问天空，然后通过 acp_cursor（continue_session=true）继续。`,
    );
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
    const pending: CursorPendingPlan = { kind: "plan", plan, planUri };
    ctx.capture.pending.push(pending);
    ctx.capture.notes.push(
      "Cursor 提交方案等待审批。请审阅 output 中的 pending_plan，自主批准或通过 clarify 核对后，以 continue_session=true 继续执行。",
    );
  }

  return { outcome: { outcome: "rejected", reason: "anima:awaiting_review" } };
}
