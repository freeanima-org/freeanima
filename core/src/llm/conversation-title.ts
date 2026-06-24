import { PROFILE_SUMMARY } from "@freeanima/core/provider";
import { chat } from "./llm.ts";
import type { LlmRuntime } from "./llm-stack.ts";

const SESSION_TITLE_INSTRUCTION = `Generate a short conversation title (at most 50 characters) from the user's first message.
Use the same language as the user. Output only the title text — no quotes, prefix, or explanation.`;

export const SESSION_TITLE_MAX_LEN = 50;

const SURROUNDING_QUOTE = new Set(['"', "'", "`"]);

function stripSurroundingQuotes(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && SURROUNDING_QUOTE.has(text[start]!)) start++;
  while (end > start && SURROUNDING_QUOTE.has(text[end - 1]!)) end--;
  return text.slice(start, end);
}

export function sanitizeConversationTitle(raw: string): string {
  return stripSurroundingQuotes(raw.trim())
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .slice(0, SESSION_TITLE_MAX_LEN)
    .trim();
}

export function fallbackConversationTitle(userText: string): string {
  return userText.slice(0, 30).trim();
}

export type GenerateConversationTitleResult =
  | { ok: true; title: string }
  | { ok: false; error: string };

export async function generateConversationTitle(
  userText: string,
  opts?: { runtime?: LlmRuntime; model?: string },
): Promise<GenerateConversationTitleResult> {
  const trimmed = userText.trim();
  if (!trimmed) {
    return { ok: false, error: "empty user text" };
  }

  try {
    const resp = await chat(
      [
        { role: "system", content: SESSION_TITLE_INSTRUCTION },
        { role: "user", content: trimmed },
      ],
      {
        profileId: PROFILE_SUMMARY,
        runtime: opts?.runtime,
        model: opts?.model,
        requestParams: { maxOutputTokens: 64 },
      },
    );
    const title = sanitizeConversationTitle(resp.content ?? "");
    if (!title) return { ok: false, error: "LLM returned empty title" };
    return { ok: true, title };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
