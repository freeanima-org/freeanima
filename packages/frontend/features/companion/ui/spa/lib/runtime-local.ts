/** Overlay 本地 runtime：bubble / play_slot；经 listener 同步到 UI store（避免单测依赖 zustand） */

import type { MotionSlotId } from "@freeanima/shared/companion-app/companion-schema.ts";

export type BubbleItem = {
  id: string;
  text: string;
  createdAt: number;
};

export type PlaySlotCommand = {
  id: string;
  slot: string;
  motionId?: string;
};

type BubbleListener = (current: { id: string; text: string } | null, pending: number) => void;

type PlayHandler = (slot: MotionSlotId, motionId?: string) => void;

let queue: BubbleItem[] = [];
let version = 0;
let bubbleListener: BubbleListener | null = null;
let playHandler: PlayHandler | null = null;

export function setRuntimeBubbleListener(listener: BubbleListener | null): void {
  bubbleListener = listener;
}

export function setRuntimePlayHandler(handler: PlayHandler | null): void {
  playHandler = handler;
}

function newBubbleId(): string {
  return `bub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function newPlayId(): string {
  return `play_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function syncBubbleToUi(): void {
  const current = queue[0] ?? null;
  bubbleListener?.(current ? { id: current.id, text: current.text } : null, queue.length);
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
  syncBubbleToUi();
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
export function advanceBubbleLocal(): BubbleItem | null {
  if (queue.length === 0) return null;
  queue.shift();
  version += 1;
  syncBubbleToUi();
  return queue[0] ?? null;
}

export function clearBubbles(): void {
  queue = [];
  version += 1;
  syncBubbleToUi();
}

export function enqueuePlaySlot(slot: string, motionId?: string): PlaySlotCommand {
  const trimmedMotionId = motionId?.trim();
  const cmd: PlaySlotCommand = {
    id: newPlayId(),
    slot: slot.trim(),
    ...(trimmedMotionId ? { motionId: trimmedMotionId } : {}),
  };
  if (!cmd.slot) throw new Error("slot 不能为空");
  playHandler?.(cmd.slot as MotionSlotId, cmd.motionId);
  return cmd;
}
