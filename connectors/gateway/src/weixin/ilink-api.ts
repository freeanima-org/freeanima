import { safeParseOrNull } from "@freeanima/kernel-schemas";
/** 腾讯 iLink Bot API（与 Python weixin_adapter 对齐） */

import { ilinkMessageSchema, type IlinkMessage } from "../schemas/weixin.ts";

export { type IlinkMessage };
export const ILINK_BASE_URL = "https://ilinkai.weixin.qq.com";
export const ILINK_APP_ID = "bot";
export const CHANNEL_VERSION = "2.2.0";

export const EP_GET_UPDATES = "ilink/bot/getupdates";
export const EP_SEND_MESSAGE = "ilink/bot/sendmessage";

export const LONG_POLL_TIMEOUT_SEC = 35;
export const API_TIMEOUT_MS = 15_000;
export const MAX_CONSECUTIVE_FAILURES = 3;
export const RETRY_DELAY_MS = 2_000;
export const BACKOFF_DELAY_MS = 30_000;

export const MSG_TYPE_USER = 1;
export const MSG_TYPE_BOT = 2;
export const MSG_STATE_FINISH = 2;
export const ITEM_TEXT = 1;

const ilinkResponseSchema = ilinkMessageSchema;

function baseInfo(): Record<string, unknown> {
  return { channel_version: CHANNEL_VERSION };
}

function headers(token: string, body: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "Content-Length": String(Buffer.byteLength(body, "utf-8")),
    "iLink-App-Id": ILINK_APP_ID,
    Authorization: `Bearer ${token}`,
  };
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
    headers: headers(token, body),
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
  return safeParseOrNull(ilinkResponseSchema, parsed) ?? {};
}

export function assertIlinkOk(resp: Record<string, unknown>, endpoint: string): void {
  const ret = resp.ret;
  const errcode = resp.errcode;
  const retNum = ret === undefined || ret === null ? 0 : Number(ret);
  const errNum = errcode === undefined || errcode === null ? 0 : Number(errcode);
  if (retNum === 0 && errNum === 0) return;
  const errmsg = String(resp.errmsg ?? resp.err_msg ?? "");
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
