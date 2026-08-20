import { randomBytes } from "node:crypto";

import {
  isRedisConfigured,
  REDIS_KV_KEY_PREFIX,
  redisDel,
  redisGet,
  redisScanEntries,
  redisSet,
  redisTtl,
} from "@freeanima/habitat/core/redis";
import type { DisplayItem } from "@freeanima/shared/rpc-contract/frames/display";

/** 临时公开分享 TTL 档 */
export const CONVERSATION_SHARE_TTL = {
  "1h": 60 * 60,
  "1d": 24 * 60 * 60,
  "1w": 7 * 24 * 60 * 60,
  "1mo": 30 * 24 * 60 * 60,
} as const;

export type ConversationShareTtl = keyof typeof CONVERSATION_SHARE_TTL;

export type ConversationShareScope = "full" | "selected";

export type ConversationShareSnapshot = {
  conversation_id: string;
  scope: ConversationShareScope;
  title?: string;
  display: DisplayItem[];
  created_at: string;
  expires_at: string;
};

export type ConversationShareListItem = {
  id: string;
  conversation_id: string;
  scope: ConversationShareScope;
  title?: string;
  created_at: string;
  expires_at: string;
  message_count: number;
  /** Redis 剩余 TTL 秒；未知为 null */
  ttl_remaining_seconds: number | null;
  url_path: string;
  /** 配置了 public.origin 时的绝对可复制链接 */
  url?: string;
};

/** Web 壳 URL 前缀（与 habitat-api/web-static WEB_URL_PREFIX 对齐） */
export const CONVERSATION_SHARE_WEB_PREFIX = "/web";

export function conversationShareUrlPath(id: string): string {
  return `/share/${id}`;
}

/** 由对外 origin 拼绝对分享链接：`{origin}/web/share/{id}` */
export function buildConversationSharePublicUrl(id: string, publicOrigin: string): string {
  const origin = publicOrigin.replace(/\/$/, "");
  return `${origin}${CONVERSATION_SHARE_WEB_PREFIX}/share/${id}`;
}

const SHARE_KEY_PREFIX = `${REDIS_KV_KEY_PREFIX}conversation-share:`;

export function conversationShareKey(id: string): string {
  return `${SHARE_KEY_PREFIX}${id}`;
}

export function conversationShareIdFromKey(key: string): string | null {
  if (!key.startsWith(SHARE_KEY_PREFIX)) return null;
  const id = key.slice(SHARE_KEY_PREFIX.length);
  return id.length > 0 ? id : null;
}

export function ttlSecondsFor(ttl: ConversationShareTtl): number {
  return CONVERSATION_SHARE_TTL[ttl];
}

export function newConversationShareId(): string {
  return randomBytes(16).toString("hex");
}

/** 仅保留选中 pos 的 message 项（tool_block 不入选） */
export function filterDisplayByPosList(
  display: DisplayItem[],
  posList: readonly number[],
): DisplayItem[] {
  const wanted = new Set(posList);
  return display.filter(
    (item) => item.type === "message" && item.pos != null && wanted.has(item.pos),
  );
}

function parseSnapshot(raw: string): ConversationShareSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as ConversationShareSnapshot;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.display)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function putConversationShare(
  id: string,
  snapshot: ConversationShareSnapshot,
  ttlSeconds: number,
): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  return redisSet(conversationShareKey(id), JSON.stringify(snapshot), ttlSeconds);
}

export async function getConversationShare(id: string): Promise<ConversationShareSnapshot | null> {
  const raw = await redisGet(conversationShareKey(id));
  if (raw == null) return null;
  return parseSnapshot(raw);
}

export async function deleteConversationShare(id: string): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  return redisDel(conversationShareKey(id));
}

export async function listConversationShares(): Promise<ConversationShareListItem[]> {
  if (!isRedisConfigured()) return [];
  const entries = await redisScanEntries(`${SHARE_KEY_PREFIX}*`);
  const items: ConversationShareListItem[] = [];
  for (const entry of entries) {
    const id = conversationShareIdFromKey(entry.key);
    if (!id) continue;
    const snapshot = parseSnapshot(entry.value);
    if (!snapshot) continue;
    const ttl = await redisTtl(entry.key);
    const ttl_remaining_seconds = ttl != null && ttl >= 0 ? ttl : ttl === -1 ? null : 0;
    items.push({
      id,
      conversation_id: snapshot.conversation_id,
      scope: snapshot.scope,
      ...(snapshot.title ? { title: snapshot.title } : {}),
      created_at: snapshot.created_at,
      expires_at: snapshot.expires_at,
      message_count: snapshot.display.filter((d) => d.type === "message").length,
      ttl_remaining_seconds,
      url_path: conversationShareUrlPath(id),
    });
  }
  items.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  return items;
}
