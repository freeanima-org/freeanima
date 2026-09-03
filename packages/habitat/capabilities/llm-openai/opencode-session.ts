/**
 * OpenCode Go 要求出站请求带 x-opencode-session，便于其按会话优化。
 * 缺头自 09/06 起可能直接报错。
 */

import {
  getToolContextId,
  getToolConversationId,
  getToolParentConversationId,
} from "@freeanima/habitat/core/tool";
import { randomUUID } from "node:crypto";
import type { SdkFetch } from "./sdk-retry-guard.ts";

export const OPENCODE_SESSION_HEADER = "x-opencode-session";

/** 仅匹配 OpenCode Go 网关（默认 https://opencode.ai/zen/go/v1） */
export function isOpencodeGoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostOk = parsed.hostname === "opencode.ai" || parsed.hostname.endsWith(".opencode.ai");
    return hostOk && parsed.pathname.includes("/zen/go");
  } catch {
    return false;
  }
}

export function requestUrlString(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * 对话 ALS → 父对话 → AutoLLM contextId → 临时 UUID。
 * 保证始终有值，避免 OpenCode Go 缺头报错。
 */
export function resolveOpencodeSessionId(): string {
  return (
    getToolConversationId() ?? getToolParentConversationId() ?? getToolContextId() ?? randomUUID()
  );
}

/** 对 OpenCode Go 出站请求注入 x-opencode-session（已有则不覆盖） */
export function wrapOpencodeSession(inner: SdkFetch): SdkFetch {
  return async (input, init) => {
    const url = requestUrlString(input);
    if (!isOpencodeGoUrl(url)) {
      return inner(input, init);
    }
    const headers = new Headers(init?.headers);
    if (!headers.has(OPENCODE_SESSION_HEADER)) {
      headers.set(OPENCODE_SESSION_HEADER, resolveOpencodeSessionId());
    }
    return inner(input, { ...init, headers });
  };
}
