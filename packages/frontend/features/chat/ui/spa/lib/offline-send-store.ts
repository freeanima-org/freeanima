import { asRecord, randomPublicId } from "@freeanima/shared/util";
import { omitUndefined } from "@freeanima/shared/util";
import {
  enqueueOutboxOp,
  listOutboxOps,
  removeOutboxOp,
  resolveOutboxScope,
  type ChatSendOutboxPayload,
  type OfflineOutboxOp,
} from "@freeanima/client/portal-sdk/offline-outbox";

export type OutboxSendStatus = "pending" | "sending" | "failed" | "stale";

export type ChatOutboxEntry = {
  clientOpId: string;
  conversationId: string;
  text: string;
  expectedTailPos: number;
  status: OutboxSendStatus;
  attempts: number;
  createdAt: string;
  lastError?: string;
  /** false = 仅内存（在线直发未入 IDB）；缺省 / true = 已持久化到 outbox */
  persisted?: boolean;
};

const CHAT_MODULE_ID = "chat";

/** 进程内 claim：在线 dispatchSend 期间阻止 outbox flush 再发同一条。 */
const chatSendClaims = new Map<string, number>();

export function claimChatSend(clientOpId: string): void {
  chatSendClaims.set(clientOpId, (chatSendClaims.get(clientOpId) ?? 0) + 1);
}

export function releaseChatSend(clientOpId: string): void {
  const n = chatSendClaims.get(clientOpId) ?? 0;
  if (n <= 1) {
    chatSendClaims.delete(clientOpId);
    return;
  }
  chatSendClaims.set(clientOpId, n - 1);
}

export function isChatSendClaimed(clientOpId: string): boolean {
  return (chatSendClaims.get(clientOpId) ?? 0) > 0;
}

export function resetChatSendClaimsForTests(): void {
  chatSendClaims.clear();
}

function toEntry(op: OfflineOutboxOp, status: OutboxSendStatus): ChatOutboxEntry | null {
  if (op.moduleId !== CHAT_MODULE_ID || op.method !== "message.send") return null;
  const raw = asRecord(op.payload);
  if (!raw) return null;
  if (
    typeof raw.conversation_id !== "string" ||
    typeof raw.message !== "string" ||
    typeof raw.client_op_id !== "string"
  ) {
    return null;
  }
  const payload: ChatSendOutboxPayload = {
    conversation_id: raw.conversation_id,
    message: raw.message,
    client_op_id: raw.client_op_id,
    expected_tail_pos: typeof raw.expected_tail_pos === "number" ? raw.expected_tail_pos : 0,
    ...(typeof raw.force_tail === "boolean" ? { force_tail: raw.force_tail } : {}),
    ...(typeof raw.llm_debug === "boolean" ? { llm_debug: raw.llm_debug } : {}),
  };
  return {
    clientOpId: payload.client_op_id,
    conversationId: payload.conversation_id,
    text: payload.message,
    expectedTailPos: typeof payload.expected_tail_pos === "number" ? payload.expected_tail_pos : 0,
    status,
    attempts: 0,
    createdAt: op.createdAt,
    persisted: true,
    ...(op.lastError !== undefined ? { lastError: op.lastError } : {}),
  };
}

export async function listChatOutboxEntries(scope?: string): Promise<ChatOutboxEntry[]> {
  const resolvedScope = scope ?? resolveOutboxScope();
  const ops = await listOutboxOps(resolvedScope, CHAT_MODULE_ID);
  return ops
    .map((op) => toEntry(op, op.lastError ? "failed" : "pending"))
    .filter((e): e is ChatOutboxEntry => e != null);
}

export async function enqueueChatSend(
  conversationId: string,
  text: string,
  expectedTailPos: number,
  opts?: { clientOpId?: string; scope?: string },
): Promise<ChatOutboxEntry> {
  const scope = opts?.scope ?? resolveOutboxScope();
  const clientOpId = opts?.clientOpId ?? randomPublicId();
  const createdAt = new Date().toISOString();
  const payload: ChatSendOutboxPayload = {
    conversation_id: conversationId,
    message: text,
    client_op_id: clientOpId,
    expected_tail_pos: expectedTailPos,
  };
  const op: OfflineOutboxOp = {
    id: clientOpId,
    moduleId: CHAT_MODULE_ID,
    method: "message.send",
    payload,
    createdAt,
  };
  await enqueueOutboxOp(scope, op);
  return {
    clientOpId,
    conversationId,
    text,
    expectedTailPos,
    status: "pending",
    attempts: 0,
    createdAt,
    persisted: true,
  };
}

/** 在线直发：仅内存跟踪，不写 IDB。 */
export function createEphemeralChatSend(
  conversationId: string,
  text: string,
  expectedTailPos: number,
  opts?: { clientOpId?: string },
): ChatOutboxEntry {
  const clientOpId = opts?.clientOpId ?? randomPublicId();
  return {
    clientOpId,
    conversationId,
    text,
    expectedTailPos,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
    persisted: false,
  };
}

export async function ackChatSend(clientOpId: string, scope?: string): Promise<void> {
  await removeOutboxOp(scope ?? resolveOutboxScope(), clientOpId);
}

export async function updateChatSendPayload(
  clientOpId: string,
  patch: Partial<Pick<ChatSendOutboxPayload, "force_tail" | "expected_tail_pos" | "message">>,
  scope?: string,
): Promise<void> {
  const resolvedScope = scope ?? resolveOutboxScope();
  const ops = await listOutboxOps(resolvedScope, CHAT_MODULE_ID);
  const op = ops.find((item) => item.id === clientOpId);
  if (!op) return;
  await enqueueOutboxOp(
    resolvedScope,
    omitUndefined({
      ...op,
      lastError: undefined,
      payload: { ...op.payload, ...patch },
    }),
  );
}

export async function updateChatSendText(
  clientOpId: string,
  text: string,
  scope?: string,
): Promise<void> {
  await updateChatSendPayload(clientOpId, { message: text }, scope);
}

export async function discardChatSend(clientOpId: string, scope?: string): Promise<void> {
  await ackChatSend(clientOpId, scope);
}
