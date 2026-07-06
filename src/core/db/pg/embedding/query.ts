import { getEmbedTextFn } from "./runtime.ts";

/** Convert user query text to embedding; returns null when not configured */
export async function embedQueryText(text: string): Promise<number[] | null> {
  const embed = getEmbedTextFn();
  if (!embed) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return embed(trimmed);
}
