import { webuiCtx } from "./runtime.ts";
import { isConversationMeta } from "@freeanima/core/db/domain";
import {
  createConversationBodySchema,
  patchTitleBodySchema,
  type CreateConversationBody,
  type PatchTitleBody,
} from "@freeanima/platform/connectors/webui/api";
import { ApiHandlerError } from "./errors.ts";

function requirePlatform(platform: string | undefined): string {
  const p = platform?.trim();
  if (!p) throw new ApiHandlerError(400, "platform is required");
  return p;
}

export async function resolveConversationPlatform(conversationId: string): Promise<string> {
  const meta = await webuiCtx().conversation.loadConversationMeta(conversationId);
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
  const result = await webuiCtx().listConversations(platform, opts);
  return result;
}

export async function createConversation(body: CreateConversationBody) {
  const parsed = createConversationBodySchema.parse(body);
  return webuiCtx().createConversation(requirePlatform(parsed.platform));
}

export async function getConversationInfo(conversationId: string) {
  try {
    return await webuiCtx().getConversationInfo(
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
    return await webuiCtx().getMessages(
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
    return await webuiCtx().setConversationTitle(
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
  if (all) return webuiCtx().listCommands({ all: true });
  return webuiCtx().listCommands({ platform: requirePlatform(opts.platform), all: false });
}

export function getPlatforms() {
  return { ok: true as const, data: webuiCtx().getStatus().platforms };
}
