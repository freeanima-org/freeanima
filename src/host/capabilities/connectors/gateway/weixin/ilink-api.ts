import { safeParseOrNull } from "@freeanima/host/core/util";
import { chunkText } from "../chunk-text.ts";
/** Tencent iLink Bot API (see @tencent-weixin/openclaw-weixin src/api/api.ts) */

import { randomBytes } from "node:crypto";

import { ilinkMessageSchema, type IlinkMessage } from "../schemas/weixin.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

export { type IlinkMessage };
export const ILINK_BASE_URL = "https://ilinkai.weixin.qq.com";
export const ILINK_APP_ID = "bot";
export const CHANNEL_VERSION = "2.2.0";
/** WeChat text single-message limit (Unicode chars, protocol suggests 2000) */
export const WEIXIN_TEXT_CHUNK_LIMIT = 2000;

export const EP_GET_UPDATES = "ilink/bot/getupdates";
export const EP_SEND_MESSAGE = "ilink/bot/sendmessage";
export const EP_GET_CONFIG = "ilink/bot/getconfig";
export const EP_SEND_TYPING = "ilink/bot/sendtyping";
export const EP_NOTIFY_START = "ilink/bot/msg/notifystart";
export const EP_NOTIFY_STOP = "ilink/bot/msg/notifystop";

export const LONG_POLL_TIMEOUT_SEC = 35;
export const API_TIMEOUT_MS = 15_000;
export const CONFIG_TIMEOUT_MS = 10_000;
export const MAX_CONSECUTIVE_FAILURES = 3;
export const RETRY_DELAY_MS = 2_000;
export const BACKOFF_DELAY_MS = 30_000;

/** Session expired error code (official session-guard) */
export const SESSION_EXPIRED_ERRCODE = -14;
const SESSION_PAUSE_MS = 60 * 60 * 1000;

export const MSG_TYPE_USER = 1;
export const MSG_TYPE_BOT = 2;
export const MSG_STATE_FINISH = 2;
export const ITEM_TEXT = 1;

export const TYPING_STATUS_TYPING = 1;

const BOT_AGENT = `freeanima/${CHANNEL_VERSION}`;
const ILINK_APP_CLIENT_VERSION = buildClientVersion(CHANNEL_VERSION);

const ilinkResponseSchema = ilinkMessageSchema;
const sessionPauseUntil = new Map<string, number>();

/** Encode version as iLink-App-ClientVersion uint32 (see openclaw-weixin) */
function buildClientVersion(version: string): number {
  const parts = version.split(".").map((p) => parseInt(p, 10));
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  return ((major & 0xff) << 16) | ((minor & 0xff) << 8) | (patch & 0xff);
}

/** X-WECHAT-UIN: random uint32 → decimal string → base64 */
function randomWechatUin(): string {
  const uint32 = randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf-8").toString("base64");
}

function baseInfo(): Record<string, unknown> {
  return {
    channel_version: CHANNEL_VERSION,
    bot_agent: BOT_AGENT,
  };
}

function buildHeaders(token: string, body: string): Record<string, string> {
  const routeTag = process.env.FREEANIMA_WEIXIN_ROUTE_TAG?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "Content-Length": String(Buffer.byteLength(body, "utf-8")),
    "X-WECHAT-UIN": randomWechatUin(),
    "iLink-App-Id": ILINK_APP_ID,
    "iLink-App-ClientVersion": String(ILINK_APP_CLIENT_VERSION),
    Authorization: `Bearer ${token}`,
  };
  if (routeTag) headers.SKRouteTag = routeTag;
  return headers;
}

export function pauseWeixinSession(accountId: string): void {
  const until = Date.now() + SESSION_PAUSE_MS;
  sessionPauseUntil.set(accountId, until);
}

export function isWeixinSessionPaused(accountId: string): boolean {
  const until = sessionPauseUntil.get(accountId);
  if (until === undefined) return false;
  if (Date.now() >= until) {
    sessionPauseUntil.delete(accountId);
    return false;
  }
  return true;
}

/** Split long text into ≤limit char segments (prefer paragraph/newline boundaries) */
export function chunkWeixinText(text: string, limit = WEIXIN_TEXT_CHUNK_LIMIT): string[] {
  return chunkText(text, limit, { trimInput: true });
}

export async function apiPost(
  baseUrl: string,
  endpoint: string,
  payload: Record<string, unknown>,
  token: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const body = JSON.stringify({ ...payload, base_info: baseInfo() });
  const url = `${baseUrl.replace(/\/$/, "")}/${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(token, body),
    body,
    signal: signal ?? AbortSignal.timeout(timeoutMs),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`iLink POST ${endpoint} HTTP ${res.status}: ${raw.slice(0, 200)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`iLink POST ${endpoint}: invalid JSON`);
  }
  return safeParseOrNull(ilinkResponseSchema, parsed) ?? (parsed as Record<string, unknown>);
}

export function assertIlinkOk(resp: Record<string, unknown>, endpoint: string): void {
  const ret = resp.ret;
  const errcode = resp.errcode;
  const retNum = ret === undefined || ret == null ? 0 : Number(ret);
  const errNum = errcode === undefined || errcode == null ? 0 : Number(errcode);
  if (retNum === 0 && errNum === 0) return;
  const errmsg = coerceString(resp.errmsg ?? resp.err_msg ?? "");
  throw new Error(`iLink ${endpoint} ret=${String(ret)} errcode=${String(errcode)}: ${errmsg}`);
}

export async function getUpdates(
  baseUrl: string,
  token: string,
  syncBuf: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  try {
    const resp = await apiPost(
      baseUrl,
      EP_GET_UPDATES,
      { get_updates_buf: syncBuf },
      token,
      (LONG_POLL_TIMEOUT_SEC + 5) * 1000,
      signal,
    );
    const errNum = Number(resp.errcode ?? 0);
    if (errNum === SESSION_EXPIRED_ERRCODE) return resp;
    assertIlinkOk(resp, EP_GET_UPDATES);
    return resp;
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      return { ret: 0, msgs: [], get_updates_buf: syncBuf };
    }
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ret: 0, msgs: [], get_updates_buf: syncBuf };
    }
    throw e;
  }
}

export async function sendText(
  baseUrl: string,
  token: string,
  toUserId: string,
  text: string,
  clientId: string,
  contextToken?: string,
): Promise<Record<string, unknown>> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Cannot send empty message");

  const message: Record<string, unknown> = {
    from_user_id: "",
    to_user_id: toUserId,
    client_id: clientId,
    message_type: MSG_TYPE_BOT,
    message_state: MSG_STATE_FINISH,
    item_list: [{ type: ITEM_TEXT, text_item: { text: trimmed } }],
  };
  if (contextToken) message.context_token = contextToken;

  const resp = await apiPost(baseUrl, EP_SEND_MESSAGE, { msg: message }, token, API_TIMEOUT_MS);
  assertIlinkOk(resp, EP_SEND_MESSAGE);
  return resp;
}

export async function sendTextChunked(
  baseUrl: string,
  token: string,
  toUserId: string,
  text: string,
  clientIdPrefix: string,
  contextToken?: string,
  limit = WEIXIN_TEXT_CHUNK_LIMIT,
): Promise<{ chunks: number; lastRet: Record<string, unknown> }> {
  const parts = chunkWeixinText(text, limit);
  if (parts.length === 0) throw new Error("Cannot send empty message");

  let lastRet: Record<string, unknown> = {};
  for (let i = 0; i < parts.length; i += 1) {
    const clientId = `${clientIdPrefix}-${randomBytes(4).toString("hex")}`;
    const part = parts[i];
    if (part === undefined) continue;
    lastRet = await sendText(baseUrl, token, toUserId, part, clientId, contextToken);
    if (i + 1 < parts.length) {
      await new Promise<void>((r) => {
        setTimeout(r, 100);
      });
    }
  }
  return { chunks: parts.length, lastRet };
}

export async function getConfig(
  baseUrl: string,
  token: string,
  ilinkUserId: string,
  contextToken?: string,
): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = { ilink_user_id: ilinkUserId };
  if (contextToken) payload.context_token = contextToken;
  const resp = await apiPost(baseUrl, EP_GET_CONFIG, payload, token, CONFIG_TIMEOUT_MS);
  assertIlinkOk(resp, EP_GET_CONFIG);
  return resp;
}

export async function sendTyping(
  baseUrl: string,
  token: string,
  ilinkUserId: string,
  typingTicket: string,
  status = TYPING_STATUS_TYPING,
): Promise<void> {
  const resp = await apiPost(
    baseUrl,
    EP_SEND_TYPING,
    {
      ilink_user_id: ilinkUserId,
      typing_ticket: typingTicket,
      status,
    },
    token,
    CONFIG_TIMEOUT_MS,
  );
  assertIlinkOk(resp, EP_SEND_TYPING);
}

/** Obtain typing_ticket and send typing indicator */
export async function sendTypingIndicator(
  baseUrl: string,
  token: string,
  peerId: string,
  contextToken?: string,
): Promise<void> {
  const cfg = await getConfig(baseUrl, token, peerId, contextToken);
  const ticket = coerceString(cfg.typing_ticket ?? "").trim();
  if (!ticket) return;
  await sendTyping(baseUrl, token, peerId, ticket);
}

export async function notifyStart(
  baseUrl: string,
  token: string,
): Promise<Record<string, unknown>> {
  const resp = await apiPost(baseUrl, EP_NOTIFY_START, {}, token, CONFIG_TIMEOUT_MS);
  assertIlinkOk(resp, EP_NOTIFY_START);
  return resp;
}

export async function notifyStop(baseUrl: string, token: string): Promise<Record<string, unknown>> {
  const resp = await apiPost(baseUrl, EP_NOTIFY_STOP, {}, token, CONFIG_TIMEOUT_MS);
  assertIlinkOk(resp, EP_NOTIFY_STOP);
  return resp;
}

/** @internal For tests: reset conversation paused state */
export function _resetWeixinSessionPauseForTest(): void {
  sessionPauseUntil.clear();
}
