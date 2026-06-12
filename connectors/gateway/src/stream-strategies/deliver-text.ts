import { chunkText } from "../chunk-text.ts";

const DISCORD_MAX_LEN = 2000;

/** L3 异步投递：将长文本拆分为平台可发送的段 */
export function splitDeliverText(text: string, limit = DISCORD_MAX_LEN): string[] {
  return chunkText(text, limit, { maxChunkLength: limit });
}
