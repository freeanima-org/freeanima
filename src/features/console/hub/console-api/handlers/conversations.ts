import { consoleCtx } from "./runtime.ts";
import { isConversationMeta } from "@freeanima/core/db/domain";
import {
  createConversationBodySchema,
  patchTitleBodySchema,
  type CreateConversationBody,
  type PatchTitleBody,
} from "@freeanima/console-api/api";
import { ApiHandlerError } from "./errors.ts";

function requirePlatform(platform: string | undefined): string {
  const p = platform?.trim();
  if (!p) throw new ApiHandlerError(400, "platform is required");
  return p;
}

export async function resolveConversationPlatform(conversationId: string): Promise<string> {
  const meta = await consoleCtx().conversation.loadConversationMeta(conversationId);
  const p = isConversationMeta(meta) ? meta.platform : undefined;
  const platform = typeof p === "string" ? p.trim() : "";
  if (!platform) {
    throw new ApiHandlerError(400, `conversation ${conversationId} has no platform`);
  }
  return platform;
}

export async function listConversations(
  platform?: string,
  opts?: { offset?: number; limit?: number },
) {
  const result = await consoleCtx().listConversations(platform, opts);
  return {
    ...result,
    conversations: result.conversations.map((s) => ({
      ...s,
      conversation_id: s.id,
    })),
  };
}

export async function createConversation(body: CreateConversationBody) {
  const parsed = createConversationBodySchema.parse(body);
  return consoleCtx().createConversation(requirePlatform(parsed.platform));
}

export async function getConversationInfo(conversationId: string) {
  try {
    return await consoleCtx().getConversationInfo(
      conversationId,
      await resolveConversationPlatform(conversationId),
    );
  } catch (e) {
    throw new ApiHandlerError(404, String(e), { conversation_id: conversationId });
  }
}

export async function getStoredMessages(
  conversationId: string,
  opts?: { offset?: number; limit?: number },
) {
  try {
    return await consoleCtx().getMessages(
      conversationId,
      await resolveConversationPlatform(conversationId),
      opts,
    );
  } catch (e) {
    throw new ApiHandlerError(404, String(e), { conversation_id: conversationId });
  }
}

export async function setConversationTitle(conversationId: string, body: PatchTitleBody) {
  const { title } = patchTitleBodySchema.parse(body);
  try {
    return await consoleCtx().setConversationTitle(
      conversationId,
      title,
      await resolveConversationPlatform(conversationId),
    );
  } catch (e) {
    throw new ApiHandlerError(503, String(e), { conversation_id: conversationId });
  }
}

export function listCommands(opts: { platform?: string; all?: boolean }) {
  const all = opts.all === true;
  if (all) return consoleCtx().listCommands({ all: true });
  return consoleCtx().listCommands({ platform: requirePlatform(opts.platform), all: false });
}

export function getPlatforms() {
  return { ok: true as const, data: consoleCtx().getStatus().platforms };
}
