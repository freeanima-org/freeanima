import type { StreamEffect, StreamReplyState } from "../stream-state/types.ts";

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
