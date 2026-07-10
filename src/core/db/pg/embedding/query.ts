import { logPgComponent } from "../log.ts";

import { getEmbedTextFn } from "./runtime.ts";

const log = logPgComponent("embedding");

/** Convert user query text to embedding; returns null when not configured or upstream fails */
export async function embedQueryText(text: string): Promise<number[] | null> {
  const embed = getEmbedTextFn();
  if (!embed) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return await embed(trimmed);
  } catch (err) {
    log.warn("query embedding failed; falling back to non-vector search", {
      error: String(err),
    });
    return null;
  }
}
