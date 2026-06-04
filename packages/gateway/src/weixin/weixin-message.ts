import { safeParseOrNull } from "@freeanima/legacy-kernel";
import { ITEM_TEXT, MSG_TYPE_BOT, MSG_TYPE_USER, type IlinkMessage } from "./ilink-api";
import { ilinkMessageSchema } from "../schemas/weixin";

export type WeixinPlatformExtra = {
  weixin_user_id: string;
  weixin_peer_id: string;
  is_group: boolean;
};

export type ParsedUserTextMessage = {
  text: string;
  fromUserId: string;
  peerId: string;
  isGroup: boolean;
  contextToken: string;
  msgId: string;
};

function readField(msg: Record<string, unknown>, snake: string, camel: string): unknown {
  if (msg[snake] !== undefined && msg[snake] !== null) return msg[snake];
  return msg[camel];
}

function coerceItemType(value: unknown): number | null {
  if (value === ITEM_TEXT || value === "1") return ITEM_TEXT;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coerceMessageType(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (value === MSG_TYPE_USER || value === "1") return MSG_TYPE_USER;
  if (value === MSG_TYPE_BOT || value === "2") return MSG_TYPE_BOT;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 解包 getupdates 单条消息（兼容嵌套 msg、驼峰字段） */
export function normalizeInboundMessage(raw: IlinkMessage): IlinkMessage {
  let msg = raw;
  const nested = raw.msg;
  if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) {
    msg = nested as IlinkMessage;
  }

  const itemList = readField(msg, "item_list", "itemList");
  const normalized: Record<string, unknown> = { ...msg };
  if (itemList !== undefined) normalized.item_list = itemList;

  for (const [snake, camel] of [
    ["from_user_id", "fromUserId"],
    ["message_type", "messageType"],
    ["room_id", "roomId"],
    ["chat_room_id", "chatRoomId"],
    ["context_token", "contextToken"],
    ["msg_id", "msgId"],
    ["message_id", "messageId"],
    ["seq_id", "seqId"],
  ] as const) {
    const v = readField(msg, snake, camel);
    if (v !== undefined && v !== null) normalized[snake] = v;
  }

  return safeParseOrNull(ilinkMessageSchema, normalized) ?? normalized;
}

export function extractTextFromMessage(msg: IlinkMessage): string {
  const normalized = normalizeInboundMessage(msg);
  const items = normalized.item_list;
  if (!Array.isArray(items)) return "";

  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const itemType = coerceItemType(rec.type ?? rec.item_type);
    if (itemType !== ITEM_TEXT) continue;

    const textItem = (rec.text_item ?? rec.textItem) as Record<string, unknown> | undefined;
    if (typeof textItem === "object" && textItem !== null) {
      const text = String(textItem.text ?? textItem.content ?? "");
      if (text) return text;
    }
  }

  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const voiceItem = (rec.voice_item ?? rec.voiceItem) as Record<string, unknown> | undefined;
    if (typeof voiceItem === "object" && voiceItem !== null) {
      const voiceText = String(voiceItem.text ?? "");
      if (voiceText) return voiceText;
    }
  }

  return "";
}

/**
 * 解析伙伴文本消息（对齐 Hermes：不强制 message_type，仅排除 BOT 与自身发送者）
 */
export function parseUserTextMessage(
  msg: IlinkMessage,
  botAccountId: string,
): ParsedUserTextMessage | null {
  const normalized = normalizeInboundMessage(msg);

  const fromUser = String(normalized.from_user_id ?? "").trim();
  if (!fromUser) return null;

  const msgType = coerceMessageType(normalized.message_type);
  if (msgType === MSG_TYPE_BOT) return null;
  /** 仅过滤机器人自身发出的消息（account_id），勿用凭证里的 user_id（常为绑定人类 wxid） */
  if (botAccountId && fromUser === botAccountId) return null;

  const text = extractTextFromMessage(normalized).trim();
  if (!text) return null;

  const roomId = normalized.room_id ?? normalized.chat_room_id;
  const isGroup = Boolean(roomId);
  const peerId = String(roomId ?? fromUser);

  const msgId = String(normalized.msg_id ?? normalized.message_id ?? normalized.seq_id ?? "");

  return {
    text,
    fromUserId: fromUser,
    peerId,
    isGroup,
    contextToken: String(normalized.context_token ?? ""),
    msgId,
  };
}

/** 入站消息被 parseUserTextMessage 跳过时的人类可读原因（诊断用） */
export function explainInboundSkip(msg: IlinkMessage, botAccountId: string): string {
  const normalized = normalizeInboundMessage(msg);

  const fromUser = String(normalized.from_user_id ?? "").trim();
  if (!fromUser) return "missing from_user_id";

  const msgType = coerceMessageType(normalized.message_type);
  if (msgType === MSG_TYPE_BOT) return "message_type is BOT";

  if (botAccountId && fromUser === botAccountId) {
    return "from_user_id matches bot account_id";
  }

  const text = extractTextFromMessage(normalized).trim();
  if (!text) return "no extractable text in item_list";

  return "unknown";
}

export function buildWeixinOrigin(parsed: ParsedUserTextMessage): {
  platform: "weixin";
  platform_extra: WeixinPlatformExtra;
} {
  return {
    platform: "weixin",
    platform_extra: {
      weixin_user_id: parsed.fromUserId,
      weixin_peer_id: parsed.peerId,
      is_group: parsed.isGroup,
    },
  };
}
