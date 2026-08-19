import { habitatCtx } from "./runtime.ts";
import { isConversationMeta } from "@freeanima/habitat/core/db/domain";
import { canonicalizeConversationPlatform } from "@freeanima/shared/pg-shapes/jsonb/platform-info";
import {
  createConversationBodySchema,
  patchTitleBodySchema,
  type CreateConversationBody,
  type PatchTitleBody,
} from "@freeanima/features/habitat/habitat/habitat-api/api";
import { ApiHandlerError } from "./errors.ts";

function requirePlatform(platform: string | undefined): string {
  const p = platform?.trim();
  if (!p) throw new ApiHandlerError(400, "platform is required");
  return p;
}

export async function resolveConversationPlatform(conversationId: string): Promise<string> {
  const meta = await habitatCtx().conversation.loadConversationMeta(conversationId);
  const p = isConversationMeta(meta) ? meta.platform : undefined;
  return canonicalizeConversationPlatform(p);
}

export async function listConversations(
  platform?: string,
  opts?: { offset?: number; limit?: number },
) {
  const result = await habitatCtx().listConversations(platform, opts);
  return {
    ...result,
    conversations: result.conversations.map((s) => ({
      conversation_id: s.id,
      title: s.title,
      platform: s.platform,
      updated_at: s.updated_at,
      archived_at: s.archived_at ?? null,
      pinned_at: s.pinned_at ?? null,
    })),
  };
}

export async function createConversation(body: CreateConversationBody) {
  const parsed = createConversationBodySchema.parse(body);
  return habitatCtx().createConversation(requirePlatform(parsed.platform));
}

export async function getConversationInfo(conversationId: string) {
  try {
    return await habitatCtx().getConversationInfo(
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
    return await habitatCtx().getMessages(
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
    return await habitatCtx().setConversationTitle(
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
  if (all) return habitatCtx().listCommands({ all: true });
  return habitatCtx().listCommands({ platform: requirePlatform(opts.platform), all: false });
}

export function getPlatforms() {
  return { ok: true as const, data: habitatCtx().getStatus().platforms };
}
