export type { ChannelAction, ChannelIo, StreamStrategy, StrategyContext } from "./types.ts";
export { chunkChannelActions } from "./chunk.ts";
export {
  createStreamChannelComposer,
  type StreamChannelComposer,
  type StreamChannelComposerOptions,
} from "./composer.ts";
export { createGatewayToolRoundStrategy } from "./gateway-outbound.ts";
export { createDiscordGatewayToolRoundStrategy } from "./discord-gateway-outbound.ts";
export {
  createPassthroughEmitStrategy,
  createPassthroughToolEmitStrategy,
  createToolRoundStrategy,
} from "./tool-round.ts";
export {
  createDiscordAnswerStrategy,
  createDiscordCleanupStrategy,
  DISCORD_ANSWER_EDIT_MS,
  DISCORD_ANSWER_SPLIT_AT,
  DISCORD_STREAM_PLACEHOLDER,
  type DiscordAnswerStrategyOptions,
} from "./discord-answer.ts";
export {
  createWeixinStreamingAnswerStrategy,
  WEIXIN_ANSWER_SEND_MS,
} from "./weixin-streaming-answer.ts";
export { createWeixinBufferedAnswerStrategy } from "./weixin-answer.ts";
export { splitDeliverText } from "./deliver-text.ts";
