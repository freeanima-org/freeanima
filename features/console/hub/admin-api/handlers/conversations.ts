import { adminCtx } from "./runtime.ts";
import { isConversationMeta } from "@freeanima/core/db/domain";
import {
  createConversationBodySchema,
  patchTitleBodySchema,
  type CreateConversationBody,
  type PatchTitleBody,
} from "@freeanima/admin-api/api";
import { ApiHandlerError } from "./errors.ts";

function requirePlatform(platform: string | undefined): string {
  const p = platform?.trim();
  if (!p) throw new ApiHandlerError(400, "platform is required");
  return p;
}

export async function resolveConversationPlatform(conversationId: string): Promise<string> {
  const meta = await adminCtx().conversation.loadConversationMeta(conversationId);
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
  const result = await adminCtx().listConversations(platform, opts);
  return result;
}

export async function createConversation(body: CreateConversationBody) {
  const parsed = createConversationBodySchema.parse(body);
  return adminCtx().createConversation(requirePlatform(parsed.platform));
}

export async function getConversationInfo(conversationId: string) {
  try {
    return await adminCtx().getConversationInfo(
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
    return await adminCtx().getMessages(
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
    return await adminCtx().setConversationTitle(
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
  if (all) return adminCtx().listCommands({ all: true });
  return adminCtx().listCommands({ platform: requirePlatform(opts.platform), all: false });
}

export function getPlatforms() {
  return { ok: true as const, data: adminCtx().getStatus().platforms };
}
