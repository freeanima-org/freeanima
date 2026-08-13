import type { ImapFlow } from "imapflow";

import { normalizeRfcMessageId } from "@freeanima/features/email/domain/message-id";

export type SleepFn = (ms: number) => Promise<void>;

export type ResolveSentCopyUidOpts = {
  /** IMAP SEARCH by Message-ID；返回首个 UID 或 null */
  searchUid: () => Promise<number | null>;
  /** 未命中时 APPEND；返回新 UID 或 null */
  append: () => Promise<number | null>;
  sleep?: SleepFn;
  /** SEARCH 前/重试间隔（ms） */
  delayMs?: number;
  /** 含首次在内的 SEARCH 次数 */
  searchAttempts?: number;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Search-then-APPEND：服务商 SMTP 可能已写入 Sent 时跳过二次 APPEND。
 * 短等 + 多次 SEARCH；皆未命中再 APPEND。
 */
export async function resolveSentCopyUid(opts: ResolveSentCopyUidOpts): Promise<number | null> {
  const delayMs = opts.delayMs ?? 800;
  const searchAttempts = opts.searchAttempts ?? 3;
  const sleep = opts.sleep ?? defaultSleep;

  for (let attempt = 0; attempt < searchAttempts; attempt += 1) {
    await sleep(delayMs);
    const uid = await opts.searchUid();
    if (uid != null) return uid;
  }

  return opts.append();
}

/** IMAP SEARCH HEADER Message-ID（uid 模式）。 */
export async function searchMailboxUidByMessageId(
  client: ImapFlow,
  messageId: string,
): Promise<number | null> {
  const normalized = normalizeRfcMessageId(messageId);
  if (!normalized) return null;
  const bare = normalized.slice(1, -1);
  const candidates = [normalized, bare];
  for (const value of candidates) {
    const uids = (await client.search(
      { header: { "message-id": value } },
      { uid: true },
    )) as number[];
    const first = uids[0];
    if (first != null && Number.isFinite(first) && first > 0) {
      return first;
    }
  }
  return null;
}
