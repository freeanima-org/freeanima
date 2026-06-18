/** 文字气泡与动作播放队列（sidecar 内存；SAP tool 写入，UI 经 WebSocket 推送） */

import { broadcastRuntime, runtimeWsPayload } from "./runtime-ws.ts";

export type BubbleItem = {
  id: string;
  text: string;
  createdAt: number;
};

let queue: BubbleItem[] = [];
let version = 0;

function newBubbleId(): string {
  return `bub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emitRuntime(play: PlaySlotCommand[] = []): void {
  broadcastRuntime(runtimeWsPayload(bubbleState(), play));
}

export function enqueueBubble(text: string): BubbleItem {
  const item: BubbleItem = {
    id: newBubbleId(),
    text: text.trim(),
    createdAt: Date.now(),
  };
  if (!item.text) {
    throw new Error("气泡文字不能为空");
  }
  queue.push(item);
  version += 1;
  emitRuntime();
  return item;
}

export function bubbleState(): {
  current: BubbleItem | null;
  pending: number;
  version: number;
} {
  return {
    current: queue[0] ?? null,
    pending: queue.length,
    version,
  };
}

/** 用户点击当前气泡，展示下一条 */
export function advanceBubble(): BubbleItem | null {
  if (queue.length === 0) return null;
  queue.shift();
  version += 1;
  emitRuntime();
  return queue[0] ?? null;
}

export function clearBubbles(): void {
  queue = [];
  version += 1;
  emitRuntime();
}

export type PlaySlotCommand = {
  id: string;
  slot: string;
  motionId?: string;
};

let playVersion = 0;

function newPlayId(): string {
  return `play_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function enqueuePlaySlot(slot: string, motionId?: string): PlaySlotCommand {
  const cmd: PlaySlotCommand = {
    id: newPlayId(),
    slot: slot.trim(),
    motionId: motionId?.trim() || undefined,
  };
  if (!cmd.slot) throw new Error("slot 不能为空");
  playVersion += 1;
  emitRuntime([cmd]);
  return cmd;
}

/** @deprecated 播放指令改由 WebSocket 即时推送 */
export function drainPlayQueue(): PlaySlotCommand[] {
  return [];
}

export function runtimeState(): {
  bubble: ReturnType<typeof bubbleState>;
  playVersion: number;
} {
  return {
    bubble: bubbleState(),
    playVersion,
  };
}
