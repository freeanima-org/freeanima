import { logComponent } from "@freeanima/legacy-kernel";
import { permissionAllowOnce, parseSessionUpdateChunk } from "./generic";
import type { AcpAgentAdapter } from "./types";

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

  handleServerRequest(method, params) {
    if (method === "session/request_permission") {
      return permissionAllowOnce(params);
    }
    if (method === "cursor/ask_question") {
      return handleAskQuestion(params);
    }
    if (method === "cursor/create_plan") {
      return { outcome: { outcome: "accepted" } };
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

function handleAskQuestion(params: Record<string, unknown>): Record<string, unknown> {
  const questions = params.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return { outcome: { outcome: "skipped", reason: "anima: no questions" } };
  }
  const answers: Array<{ questionId: string; selectedOptionIds: string[] }> = [];
  for (const q of questions) {
    if (!q || typeof q !== "object") continue;
    const row = q as Record<string, unknown>;
    const questionId = String(row.id ?? "");
    const options = row.options;
    const first =
      Array.isArray(options) && options[0] && typeof options[0] === "object"
        ? String((options[0] as Record<string, unknown>).id ?? "")
        : "";
    if (questionId && first) {
      answers.push({ questionId, selectedOptionIds: [first] });
    }
  }
  if (answers.length) {
    return { outcome: { outcome: "answered", answers } };
  }
  return { outcome: { outcome: "skipped", reason: "anima headless default" } };
}
