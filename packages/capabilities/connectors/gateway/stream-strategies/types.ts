import { isRecord } from "@freeanima/shared/util";

import type { StreamEffect, StreamReplyState } from "../stream-state/types.ts";
import type { FirstFlushGate } from "./first-flush-gate.ts";

export type ChannelAction =
  | { op: "send"; text: string }
  | { op: "edit"; text: string }
  | { op: "emit"; event: string; data: unknown }
  | { op: "noop" };

export type StrategyContext = {
  state: StreamReplyState;
  signal?: AbortSignal;
  bag: Map<string, unknown>;
};

export function bagGetString(bag: Map<string, unknown>, key: string): string | undefined {
  const v = bag.get(key);
  return typeof v === "string" ? v : undefined;
}

export function bagGetNumber(bag: Map<string, unknown>, key: string): number | undefined {
  const v = bag.get(key);
  return typeof v === "number" ? v : undefined;
}

export function bagGetTimeout(
  bag: Map<string, unknown>,
  key: string,
): ReturnType<typeof setTimeout> | undefined {
  const v = bag.get(key);
  if (v == null) return undefined;
  // bag 存 setTimeout 句柄（number | Timeout），无可靠 runtime 判别
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- strategy bag timer 边界
  return v as ReturnType<typeof setTimeout>;
}

/** FirstFlushGate 鸭子类型窄化 */
export function bagGetGate(bag: Map<string, unknown>, key: string): FirstFlushGate | undefined {
  const v = bag.get(key);
  if (!isRecord(v)) return undefined;
  if (
    typeof v.dispose !== "function" ||
    typeof v.isOpen !== "function" ||
    typeof v.onDelta !== "function" ||
    typeof v.flushPending !== "function"
  ) {
    return undefined;
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- FirstFlushGate 鸭子类型边界
  return v as FirstFlushGate;
}

export type StreamStrategy = {
  name: string;
  handle(effect: StreamEffect, ctx: StrategyContext): ChannelAction[] | Promise<ChannelAction[]>;
  flush?(ctx: StrategyContext): ChannelAction[] | Promise<ChannelAction[]>;
  dispose?(ctx: StrategyContext): Promise<void>;
};

export type ChannelIo = {
  send?: (text: string) => Promise<void>;
  edit?: (text: string) => Promise<void>;
  emit?: (event: string, data: unknown) => Promise<void> | void;
};
