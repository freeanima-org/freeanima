/**
 * 会话 slash / LLM debug RPC（平台可注入；Chat / Coding 共用）。
 */

import { isHabitatFetchAvailable } from "@freeanima/client/portal-sdk/habitat-fetch-gate";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import type { LlmDebugSnapshotPayload } from "./types.ts";

function habitat() {
  return getTypedHabitatClient();
}

function requireHabitatFetch(method: string): void {
  if (!isHabitatFetchAvailable()) {
    throw new Error(`${method} unavailable offline`);
  }
}

export async function listConversationCommands(opts?: { all?: boolean; platform?: string }) {
  return habitat().call("conversation.commands", {
    ...(opts?.platform != null ? { platform: opts.platform } : {}),
    all: opts?.all,
  });
}

export type ConversationCommandResult =
  | { delivery: "message" }
  | { delivery: "rpc"; ux: "panel" | "toast" | "none"; text: string; command: string };

/** Terminal slash path (panel / toast); may redirect to message.send via delivery: message */
export async function runConversationCommand(
  conversationId: string,
  text: string,
): Promise<ConversationCommandResult> {
  requireHabitatFetch("conversation.command");
  const raw = await habitat().call(
    "conversation.command",
    {
      conversation_id: conversationId,
      text,
    },
    { transport: "http" },
  );
  if (raw && typeof raw === "object" && "delivery" in raw) {
    return raw;
  }
  throw new Error("conversation.command returned invalid payload");
}

export async function fetchLlmDebug(conversationId: string): Promise<{
  initial?: LlmDebugSnapshotPayload;
  final?: LlmDebugSnapshotPayload;
  updated_at?: string;
}> {
  const raw = await habitat().call("llm_debug.get", { conversation_id: conversationId });
  if (!raw || typeof raw !== "object") return {};
  return raw as {
    initial?: LlmDebugSnapshotPayload;
    final?: LlmDebugSnapshotPayload;
    updated_at?: string;
  };
}
