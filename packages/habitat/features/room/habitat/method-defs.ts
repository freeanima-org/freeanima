import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";
import {
  roomAgentTurnInputSchema,
  roomAgentTurnOutputSchema,
  roomAgentConversationInputSchema,
  roomAgentConversationOutputSchema,
  roomCreateInputSchema,
  roomCreateOutputSchema,
  roomDisbandInputSchema,
  roomDisbandOutputSchema,
  roomGetInputSchema,
  roomGetOutputSchema,
  roomLeaveInputSchema,
  roomLeaveOutputSchema,
  roomListInputSchema,
  roomListOutputSchema,
  roomMessageSendInputSchema,
  roomMessageSendOutputSchema,
  roomMessagesListInputSchema,
  roomMessagesListOutputSchema,
  roomMembersAddInputSchema,
  roomMembersAddOutputSchema,
  roomMembersKickInputSchema,
  roomMembersKickOutputSchema,
  roomSpeakerAcquireInputSchema,
  roomSpeakerAcquireOutputSchema,
  roomSpeakerHeartbeatInputSchema,
  roomSpeakerHeartbeatOutputSchema,
  roomSpeakerInterruptInputSchema,
  roomSpeakerInterruptOutputSchema,
  roomSpeakerTurnCompleteInputSchema,
  roomSpeakerTurnCompleteOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/room";
import {
  roomSyncStatusInputSchema,
  roomSyncStatusOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/room-federation.ts";

export const roomMethodDefs = {
  "room.create": defineHabitatMethod({
    input: roomCreateInputSchema,
    output: roomCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "room.get": defineHabitatMethod({
    input: roomGetInputSchema,
    output: roomGetOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "room.list": defineHabitatMethod({
    input: roomListInputSchema,
    output: roomListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "room.disband": defineHabitatMethod({
    input: roomDisbandInputSchema,
    output: roomDisbandOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "room.members.add": defineHabitatMethod({
    input: roomMembersAddInputSchema,
    output: roomMembersAddOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "room.members.kick": defineHabitatMethod({
    input: roomMembersKickInputSchema,
    output: roomMembersKickOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "room.leave": defineHabitatMethod({
    input: roomLeaveInputSchema,
    output: roomLeaveOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "room.messages.list": defineHabitatMethod({
    input: roomMessagesListInputSchema,
    output: roomMessagesListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "room.message.send": defineHabitatMethod({
    input: roomMessageSendInputSchema,
    output: roomMessageSendOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "room.speaker.acquire": defineHabitatMethod({
    input: roomSpeakerAcquireInputSchema,
    output: roomSpeakerAcquireOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "room.speaker.heartbeat": defineHabitatMethod({
    input: roomSpeakerHeartbeatInputSchema,
    output: roomSpeakerHeartbeatOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "room.speaker.turn_complete": defineHabitatMethod({
    input: roomSpeakerTurnCompleteInputSchema,
    output: roomSpeakerTurnCompleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "room.speaker.interrupt": defineHabitatMethod({
    input: roomSpeakerInterruptInputSchema,
    output: roomSpeakerInterruptOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "room.agent.turn": defineHabitatMethod({
    input: roomAgentTurnInputSchema,
    output: roomAgentTurnOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "room.agent.conversation": defineHabitatMethod({
    input: roomAgentConversationInputSchema,
    output: roomAgentConversationOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "room.syncStatus": defineHabitatMethod({
    input: roomSyncStatusInputSchema,
    output: roomSyncStatusOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;
