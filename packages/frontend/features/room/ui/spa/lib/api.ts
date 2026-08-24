import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { resumeMessageStream } from "@freeanima/features/chat/ui/spa/lib/api.ts";
import type { StreamApiEvent } from "@freeanima/features/chat/ui/spa/lib/types.ts";

function habitat() {
  return getTypedHabitatClient();
}

export async function roomList() {
  return habitat().call("room.list", {});
}

export async function roomGet(room_id: string) {
  const data = await habitat().call("room.get", { room_id });
  return data.room;
}

export async function roomCreate(input: {
  title: string;
  owner_public_id: string;
  member_public_ids: string[];
  federated?: boolean;
}) {
  const data = await habitat().call("room.create", input);
  return data.room;
}

export async function roomSyncStatus(room_id: string) {
  const data = await habitat().call("room.syncStatus", { room_id });
  return data.sync;
}

export async function federationStatus() {
  return habitat().call("federation.status", {});
}

export async function roomMessagesList(room_id: string) {
  const data = await habitat().call("room.messages.list", { room_id, limit: 100 });
  return data.messages;
}

export async function roomMessageSend(input: {
  room_id: string;
  speaker_public_id: string;
  text: string;
  mention_public_ids?: string[];
}) {
  return habitat().call("room.message.send", input);
}

export async function roomAgentTurn(input: { room_id: string; agent_public_id: string }) {
  return habitat().call("room.agent.turn", input);
}

export async function roomAgentConversation(input: { room_id: string; agent_public_id: string }) {
  return habitat().call("room.agent.conversation", input);
}

export async function roomSpeakerInterrupt(input: { room_id: string; actor_public_id: string }) {
  await habitat().call("room.speaker.interrupt", input);
}

export async function roomMembersAdd(input: {
  room_id: string;
  actor_public_id: string;
  member_public_ids: string[];
}) {
  const data = await habitat().call("room.members.add", input);
  return data.room;
}

export async function roomMembersKick(input: {
  room_id: string;
  actor_public_id: string;
  member_public_id: string;
}) {
  const data = await habitat().call("room.members.kick", input);
  return data.room;
}

export async function roomLeave(input: { room_id: string; actor_public_id: string }) {
  await habitat().call("room.leave", input);
}

export async function roomDisband(input: { room_id: string; actor_public_id: string }) {
  await habitat().call("room.disband", input);
}

/** 订阅 room.agent.turn / @ 触发的流，直到 done/error。 */
export function attachRoomAgentStream(
  streamId: string,
  handlers: {
    onToken?: (text: string) => void;
    onDone?: () => void;
    onError?: (message: string) => void;
  },
): { unsubscribe: () => void } {
  let text = "";
  return resumeMessageStream(streamId, {
    onData: (ev: StreamApiEvent) => {
      if (ev.event === "token") {
        text += ev.data.content;
        handlers.onToken?.(text);
      } else if (ev.event === "content_replace") {
        text = ev.data.content;
        handlers.onToken?.(text);
      } else if (ev.event === "error") {
        handlers.onError?.(ev.data.error || "流式错误");
      } else if (ev.event === "done" || ev.event === "interrupted") {
        handlers.onDone?.();
      }
    },
    onError: (err) => handlers.onError?.(err.message || "流式错误"),
    onComplete: () => handlers.onDone?.(),
  });
}
