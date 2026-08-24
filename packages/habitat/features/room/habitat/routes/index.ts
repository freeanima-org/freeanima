import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  asRouteCtx,
  asRouteDeps,
  bindHabitatRouteHandlers,
} from "@freeanima/shared/habitat-contract/route.ts";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";
import type { RemoteToolsServerDeps } from "@freeanima/habitat/capabilities/outpost/transport/types";

import { roomMethodDefs } from "../method-defs.ts";
import * as room from "../../domain/room-service.ts";
import { startRoomAgentTurnStream } from "../stream.ts";

type RoomRemoteDeps = RemoteToolsServerDeps & {
  runtime: {
    runtimeDeps(): {
      conversation: import("@freeanima/habitat/engine/conversation").ConversationService;
    };
    interruptSessionStream?: (conversationId: string) => void;
    continueMessageStream: (
      conversationId: string,
      platform?: string,
      origin_extra?: Record<string, unknown>,
    ) => AsyncGenerator;
    sendMessageStream: (
      conversationId: string,
      message: string,
      platform?: string,
      origin_extra?: Record<string, unknown>,
    ) => AsyncGenerator;
  };
};

function depsOf(deps: unknown): RoomRemoteDeps {
  return asRouteDeps<RoomRemoteDeps>(deps);
}

function ctxOf(ctx: unknown): RemoteToolsRequestContext {
  return asRouteCtx<RemoteToolsRequestContext>(ctx);
}

function domainDeps(deps: unknown): room.RoomDomainDeps {
  const runtime = depsOf(deps).runtime;
  const conversation = runtime.runtimeDeps().conversation;
  return {
    newConversation: (...args) => conversation.newConversation(...args),
    ...(typeof runtime.interruptSessionStream === "function"
      ? {
          interruptConversation: (id: string) => {
            runtime.interruptSessionStream?.(id);
          },
        }
      : {}),
  };
}

export const roomHabitatRoutes = bindHabitatRouteHandlers(roomMethodDefs, {
  "room.create": async (deps, input) => {
    const roomSummary = await room.createRoom(
      domainDeps(deps),
      omitUndefined({
        title: input.title,
        owner_public_id: input.owner_public_id,
        member_public_ids: input.member_public_ids,
        federated: input.federated,
      }),
    );
    return { room: roomSummary };
  },
  "room.get": async (_deps, input) => {
    const roomSummary = await room.getRoomSummary(input.room_id);
    if (!roomSummary) throw new Error("ROOM_NOT_FOUND");
    return { room: roomSummary };
  },
  "room.list": async (_deps, input) =>
    room.listRoomSummaries(omitUndefined({ offset: input.offset, limit: input.limit })),
  "room.disband": async (_deps, input) => {
    await room.disbandRoom(input.room_id, input.actor_public_id);
    return { ok: true as const };
  },
  "room.members.add": async (deps, input) => {
    const roomSummary = await room.addRoomMembers(domainDeps(deps), input);
    return { room: roomSummary };
  },
  "room.members.kick": async (deps, input) => {
    const roomSummary = await room.kickRoomMember(domainDeps(deps), input);
    return { room: roomSummary };
  },
  "room.leave": async (deps, input) => {
    await room.leaveRoom(domainDeps(deps), input);
    return { ok: true as const };
  },
  "room.messages.list": async (_deps, input) => {
    const messages = await room.listMessages(
      input.room_id,
      omitUndefined({ before_seq: input.before_seq, limit: input.limit }),
    );
    return { messages };
  },
  "room.message.send": async (deps, input, ctx) => {
    const d = depsOf(deps);
    const result = await room.sendHumanMessage(domainDeps(deps), omitUndefined(input));
    const triggered_agent_turns: Array<{
      agent_public_id: string;
      conversation_id: string;
      stream_id: string;
    }> = [];
    for (const agent_public_id of result.mention_local_agent_ids) {
      const turn = await startRoomAgentTurnStream(
        d,
        ctxOf(ctx),
        { room_id: input.room_id, agent_public_id },
        domainDeps(deps),
      );
      if (turn.ok && turn.conversation_id && turn.stream_id) {
        triggered_agent_turns.push({
          agent_public_id,
          conversation_id: turn.conversation_id,
          stream_id: turn.stream_id,
        });
      }
    }
    return {
      message: result.message,
      ...(triggered_agent_turns.length > 0 ? { triggered_agent_turns } : {}),
    };
  },
  "room.speaker.acquire": async (_deps, input) =>
    room.acquireSpeaker(input.room_id, input.agent_public_id),
  "room.speaker.heartbeat": async (_deps, input) =>
    room.heartbeatSpeaker(input.room_id, input.agent_public_id),
  "room.speaker.turn_complete": async (_deps, input) => {
    await room.turnCompleteSpeaker(input.room_id, input.agent_public_id);
    return { ok: true as const };
  },
  "room.speaker.interrupt": async (deps, input) => {
    await room.interruptSpeaker(domainDeps(deps), input.room_id, input.actor_public_id);
    return { ok: true as const };
  },
  "room.agent.turn": async (deps, input, ctx) =>
    startRoomAgentTurnStream(depsOf(deps), ctxOf(ctx), input, domainDeps(deps)),
  "room.agent.conversation": async (deps, input) =>
    room.ensureRoomAgentConversation(domainDeps(deps), input.room_id, input.agent_public_id),
  "room.syncStatus": async (_deps, input) => {
    const { getRoomSyncStatus } = await import("../../domain/room-federation.ts");
    const sync = await getRoomSyncStatus(input.room_id);
    if (!sync) throw new Error("ROOM_NOT_FOUND");
    return { sync };
  },
});
