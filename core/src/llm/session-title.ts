import { PROFILE_SUMMARY } from "@freeanima/core/provider";
import { chat } from "./llm.ts";
import type { LlmRuntime } from "./llm-stack.ts";

const SESSION_TITLE_INSTRUCTION = `Generate a short session title (at most 50 characters) from the user's first message.
Use the same language as the user. Output only the title text — no quotes, prefix, or explanation.`;

export const SESSION_TITLE_MAX_LEN = 50;

export function sanitizeSessionTitle(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .slice(0, SESSION_TITLE_MAX_LEN)
    .trim();
}

export function fallbackSessionTitle(userText: string): string {
  return userText.slice(0, 30).trim();
}

export type GenerateSessionTitleResult = { ok: true; title: string } | { ok: false; error: string };

export async function generateSessionTitle(
  userText: string,
  opts?: { runtime?: LlmRuntime; model?: string },
): Promise<GenerateSessionTitleResult> {
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
    const title = sanitizeSessionTitle(resp.content ?? "");
    if (!title) return { ok: false, error: "LLM returned empty title" };
    return { ok: true, title };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
