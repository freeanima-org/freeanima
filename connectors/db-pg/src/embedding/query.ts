import { getEmbedTextFn } from "./runtime.ts";

/** 将用户查询文本转为 embedding；未配置时返回 null */
export async function embedQueryText(text: string): Promise<number[] | null> {
  const embed = getEmbedTextFn();
  if (!embed) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return embed(trimmed);
}
