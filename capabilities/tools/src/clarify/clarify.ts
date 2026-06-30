import type { Config } from "@freeanima/core/config";
import { formatCstIso } from "@freeanima/core/util";
import {
  clarifyToolAwaitingResultSchema,
  clarifyToolResolvedResultSchema,
  isConversationMeta,
  parseAwaitingClarify,
  type AwaitingClarify,
  type ClarifyItem,
  type ClarifyToolAwaitingResult,
  type ClarifyToolResolvedResult,
} from "@freeanima/core/db/domain";
import { safeParseOrNull } from "@freeanima/core/util";
import { parseToolResult } from "@freeanima/core/tool";
import type { ConversationPort } from "@freeanima/core/tool/conversation-port";

export type { ClarifyItem, AwaitingClarify };
export type ClarifyAwaitingResult = ClarifyToolAwaitingResult;
export type ClarifyResolvedResult = ClarifyToolResolvedResult;

export type GuardAwaitingResult =
  | { ok: true; expired?: false }
  | { ok: true; expired: true; hint: string }
  | { ok: false; reason: string };

const DEFAULT_TIMEOUT_SEC = 1800;
const DEFAULT_MAX_ITEMS = 5;

let clarifyConfig: Config | null = null;

export function bindClarifyConfig(config: Config): void {
  clarifyConfig = config;
}

export function resetClarifyConfigForTest(): void {
  clarifyConfig = null;
}

function requireClarifyConfig(): Config {
  if (!clarifyConfig) {
    throw new Error("Clarify config not bound; call registerClarifyHooks first");
  }
  return clarifyConfig;
}

function parseAwaiting(raw: unknown): AwaitingClarify | null {
  return parseAwaitingClarify(raw);
}

export function getClarifyConfig(): { timeout_sec: number; max_items: number } {
  const cfg = requireClarifyConfig().data;
  const clarify = cfg.clarify ?? {};
  return {
    timeout_sec:
      typeof clarify.timeout_sec === "number" && clarify.timeout_sec >= 60
        ? clarify.timeout_sec
        : DEFAULT_TIMEOUT_SEC,
    max_items:
      typeof clarify.max_items === "number" && clarify.max_items >= 1
        ? clarify.max_items
        : DEFAULT_MAX_ITEMS,
  };
}

export async function readAwaitingClarify(
  conversation: ConversationPort,
  conversationId: string,
): Promise<AwaitingClarify | null> {
  const meta = await conversation.loadConversationMeta(conversationId);
  if (!isConversationMeta(meta)) return null;
  return parseAwaiting(meta.awaiting_clarify);
}

export async function setAwaitingClarify(
  conversation: ConversationPort,
  conversationId: string,
  payload: { items: ClarifyItem[]; timeout_sec: number },
  opts?: { asked_at?: string },
): Promise<void> {
  const awaiting: AwaitingClarify = {
    items: payload.items,
    required: true,
    asked_at: opts?.asked_at ?? formatCstIso(),
    timeout_sec: payload.timeout_sec,
  };
  await conversation.updateConversationMetaField(conversationId, { awaiting_clarify: awaiting });
}

export async function clearAwaitingClarify(
  conversation: ConversationPort,
  conversationId: string,
): Promise<void> {
  await conversation.updateConversationMetaField(conversationId, { awaiting_clarify: undefined });
}

export function isAwaitingClarifyExpired(awaiting: AwaitingClarify): boolean {
  const asked = Date.parse(awaiting.asked_at);
  if (Number.isNaN(asked)) return true;
  return Date.now() > asked + awaiting.timeout_sec * 1000;
}

export async function expireIfNeeded(
  conversation: ConversationPort,
  conversationId: string,
): Promise<{ expired: boolean; hint?: string }> {
  const awaiting = await readAwaitingClarify(conversation, conversationId);
  if (!awaiting) return { expired: false };
  if (!isAwaitingClarifyExpired(awaiting)) return { expired: false };
  await clearAwaitingClarify(conversation, conversationId);
  return { expired: true, hint: "Previous questions have expired." };
}

export function mergeClarifyResponse(items: ClarifyItem[], userText: string): string {
  const lines = ["[The assistant previously asked:]"];
  for (let i = 0; i < items.length; i++) {
    lines.push(`${i + 1}. ${items[i]!.question}`);
  }
  lines.push("[The user responded:]", userText);
  return lines.join("\n");
}

export function formatClarifyText(items: ClarifyItem[]): string {
  const parts: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    parts.push(`❓ ${i + 1}. ${item.question}`);
    if (item.choices?.length) {
      for (let j = 0; j < item.choices.length; j++) {
        parts.push(`   ${j + 1}. ${item.choices[j]}`);
      }
    }
  }
  return parts.join("\n");
}

export async function guardAwaitingClarify(
  conversation: ConversationPort,
  conversationId: string,
  message: string,
): Promise<GuardAwaitingResult> {
  const expiry = await expireIfNeeded(conversation, conversationId);
  if (expiry.expired) {
    return { ok: true, expired: true, hint: expiry.hint ?? "Previous questions have expired." };
  }

  const awaiting = await readAwaitingClarify(conversation, conversationId);
  if (!awaiting) return { ok: true };

  const trimmed = message.trim();
  if (/^\/cancel(\s|$)/i.test(trimmed)) return { ok: true };

  if (trimmed.startsWith("/")) {
    return {
      ok: false,
      reason: "Please answer the questions above, or send /cancel to cancel.",
    };
  }

  return { ok: true };
}

export function parseClarifyToolResult(
  content: string,
): ClarifyAwaitingResult | ClarifyResolvedResult | { error: string } | null {
  const parsed = parseToolResult<unknown>(content);
  if (!parsed.ok) {
    if (parsed.error === "invalid JSON") return null;
    return { error: parsed.error };
  }
  const data = parsed.data;

  const awaiting = safeParseOrNull(clarifyToolAwaitingResultSchema, data);
  if (awaiting) return awaiting;

  const resolved = safeParseOrNull(clarifyToolResolvedResultSchema, data);
  if (resolved) return resolved;

  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    (data as { status?: string }).status === "awaiting" &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    const timeout =
      typeof (data as { timeout_sec?: unknown }).timeout_sec === "number" &&
      (data as { timeout_sec: number }).timeout_sec >= 60
        ? (data as { timeout_sec: number }).timeout_sec
        : getClarifyConfig().timeout_sec;
    const items: ClarifyItem[] = [];
    for (const item of (data as { items: unknown[] }).items) {
      if (!item || typeof item !== "object") continue;
      const q = item as Record<string, unknown>;
      if (typeof q.question !== "string" || !q.question.trim()) continue;
      const out: ClarifyItem = { question: q.question.trim() };
      if (Array.isArray(q.choices)) {
        out.choices = q.choices.filter((c): c is string => typeof c === "string").slice(0, 4);
      }
      if (typeof q.default === "string") out.default = q.default;
      items.push(out);
    }
    if (items.length > 0) return { status: "awaiting", items, timeout_sec: timeout };
  }
  return null;
}

export function findAwaitingClarifyInMessages(
  messages: Record<string, unknown>[],
): ClarifyAwaitingResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== "tool" || msg.name !== "clarify") continue;
    const content = typeof msg.content === "string" ? msg.content : "";
    const parsed = parseClarifyToolResult(content);
    if (parsed && "status" in parsed && parsed.status === "awaiting") return parsed;
  }
  return null;
}

export async function resolveUserContent(
  conversation: ConversationPort,
  conversationId: string,
  userText: string,
): Promise<string> {
  const expiry = await expireIfNeeded(conversation, conversationId);
  if (expiry.expired) {
    return `${expiry.hint ?? "Previous questions have expired."}\n\n${userText}`;
  }

  const awaiting = await readAwaitingClarify(conversation, conversationId);
  if (awaiting) {
    await clearAwaitingClarify(conversation, conversationId);
    return mergeClarifyResponse(awaiting.items, userText);
  }
  return userText;
}
