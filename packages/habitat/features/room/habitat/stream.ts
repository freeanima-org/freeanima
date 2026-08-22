import { randomPublicId } from "@freeanima/shared/util/random-public-id.ts";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import type { RemoteToolsServerDeps } from "@freeanima/habitat/capabilities/outpost/transport/types";
import { rememberLlmDebugFromStreamPayload } from "@freeanima/features/chat/habitat/llm-debug-cache.ts";
import { streamSessionRegistry } from "@freeanima/features/chat/habitat/stream-session-registry.ts";
import { resolveConversationPlatform } from "@freeanima/features/chat/habitat/stream.ts";
import {
  ROOM_MESSAGE_CREATED_EVENT,
  ROOM_SPEAKER_CHANGED_EVENT,
} from "@freeanima/shared/rpc-contract/frames/room.ts";

import { z } from "zod";

import * as room from "../domain/room-service.ts";

const ROOM_TURN_CUE = "请根据当前群聊公开上下文发言。";

const textPartSchema = z.object({ text: z.string() });

function textFromContentPart(value: unknown): string {
  const parsed = textPartSchema.safeParse(value);
  return parsed.success ? parsed.data.text : "";
}

async function loadStreamBridge() {
  return import("@freeanima/habitat/capabilities/outpost/transport/stream-bridge");
}

function publishStreamEvent(
  fallback: RemoteToolsRequestContext,
  method: string,
  payload: Record<string, unknown>,
): void {
  if (!streamSessionRegistry.applyAndPublish(method, payload)) {
    fallback.sendEvent(method, payload);
  }
}

function broadcastRoomEvents(
  deps: RemoteToolsServerDeps,
  roomId: string,
  agentPublicId: string,
  message: Awaited<ReturnType<typeof room.writebackAgentPublicReply>>,
): void {
  const hub = deps.hubSessionRegistry;
  const payloadMsg = message ? { room_id: roomId, message } : null;
  const payloadSpeaker = {
    room_id: roomId,
    speaker_public_id: null as string | null,
    agent_public_id: agentPublicId,
  };
  for (const subjectType of ["user", "agent"] as const) {
    if (payloadMsg) {
      hub.broadcastToSubject(subjectType, ROOM_MESSAGE_CREATED_EVENT, payloadMsg);
    }
    hub.broadcastToSubject(subjectType, ROOM_SPEAKER_CHANGED_EVENT, payloadSpeaker);
  }
}

/**
 * 准备并开泵：返回 stream_id；LLM 流式结束后回写 Room 公开句并释锁。
 */
export async function startRoomAgentTurnStream(
  deps: RemoteToolsServerDeps,
  ctx: RemoteToolsRequestContext,
  input: { room_id: string; agent_public_id: string },
  domainDeps: room.RoomDomainDeps,
): Promise<{
  ok: boolean;
  conversation_id?: string;
  stream_id?: string;
  reason?: string;
}> {
  const prepared = await room.prepareAgentTurn(domainDeps, input);
  if (!prepared.ok || !prepared.conversation_id || !prepared.stream_mode) {
    return { ok: false, reason: prepared.reason ?? "PREPARE_FAILED" };
  }

  const conversationId = prepared.conversation_id;
  const streamId = randomPublicId();
  const platform = await resolveConversationPlatform(deps, conversationId);
  streamSessionRegistry.openSession(streamId, conversationId);

  void pumpRoomAgentStream(
    deps,
    ctx,
    streamId,
    conversationId,
    platform,
    prepared.stream_mode,
    input.room_id,
    input.agent_public_id,
  );

  return { ok: true, conversation_id: conversationId, stream_id: streamId };
}

async function pumpRoomAgentStream(
  deps: RemoteToolsServerDeps,
  ctx: RemoteToolsRequestContext,
  streamId: string,
  conversationId: string,
  platform: string,
  streamMode: "continue" | "send",
  roomId: string,
  agentPublicId: string,
): Promise<void> {
  const { bridgeMessageStream } = await loadStreamBridge();

  const unsubscribe = streamSessionRegistry.subscribe(streamId, (method, payload) => {
    ctx.sendEvent(method, payload);
  });

  let failed = false;
  try {
    const generator =
      streamMode === "continue"
        ? deps.runtime.continueMessageStream(conversationId, platform)
        : deps.runtime.sendMessageStream(conversationId, ROOM_TURN_CUE, platform);

    for await (const mapped of bridgeMessageStream(streamId, generator)) {
      if (mapped.method === "stream.llm_debug") {
        await rememberLlmDebugFromStreamPayload(conversationId, mapped.payload);
        continue;
      }
      if (mapped.method === "stream.error" || mapped.method === "stream.interrupted") {
        failed = true;
      }
      publishStreamEvent(ctx, mapped.method, mapped.payload);
    }
  } catch (e) {
    failed = true;
    publishStreamEvent(ctx, "stream.error", {
      stream_id: streamId,
      error: String(e),
    });
    publishStreamEvent(ctx, "stream.done", { stream_id: streamId });
  } finally {
    unsubscribe?.();
    try {
      const session = streamSessionRegistry.getSession(streamId);
      let answer = session?.answer_text?.trim() ?? "";
      if (!answer && session?.display_items?.length) {
        for (let i = session.display_items.length - 1; i >= 0; i--) {
          const item = session.display_items[i];
          if (item?.type === "message" && item.role === "assistant" && item.content?.trim()) {
            answer = item.content.trim();
            break;
          }
        }
      }
      if (!answer) {
        // display_append 会清空 answer_text；回退读内心会话末条 assistant
        const { getDb } = await import("@freeanima/habitat/core/db/pg/client.ts");
        const { messages } = await import("@freeanima/habitat/core/db/schema");
        const { desc, eq } = await import("drizzle-orm");
        const rows = await getDb()
          .select({ payload: messages.payload })
          .from(messages)
          .where(eq(messages.conversation_id, conversationId))
          .orderBy(desc(messages.pos))
          .limit(20);
        for (const row of rows) {
          const payload = row.payload as { role?: string; content?: unknown };
          if (payload.role !== "assistant") continue;
          const content =
            typeof payload.content === "string"
              ? payload.content
              : Array.isArray(payload.content)
                ? payload.content.map(textFromContentPart).join("")
                : "";
          if (content.trim()) {
            answer = content.trim();
            break;
          }
        }
      }

      if (!failed && answer) {
        const message = await room.writebackAgentPublicReply({
          room_id: roomId,
          agent_public_id: agentPublicId,
          conversation_id: conversationId,
          text: answer,
        });
        broadcastRoomEvents(deps, roomId, agentPublicId, message);
      } else {
        await room.turnCompleteSpeaker(roomId, agentPublicId);
        broadcastRoomEvents(deps, roomId, agentPublicId, null);
      }
    } catch (e) {
      console.error("[room] writeback after stream failed", e);
      try {
        await room.turnCompleteSpeaker(roomId, agentPublicId);
      } catch {
        /* ignore */
      }
    }
  }
}
