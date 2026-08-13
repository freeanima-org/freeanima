import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";

import type { EmailContentType } from "@freeanima/host/core/db/schema/entity";
import { coerceString } from "@freeanima/shared/coerce-string";

export type ParsedEmailAttachment = {
  filename: string;
  content_type: string;
  size: number;
  content: Buffer;
  content_id?: string;
  content_disposition?: string;
};

export type ParsedEmailMime = {
  /** 纯文本（multipart/alternative 优先 text/plain；仅 html 时为抽取文本） */
  text: string;
  /** 原始 HTML（若有） */
  html: string | null;
  /** 入库 content raw：优先 html，否则 plain */
  content: string;
  content_type: EmailContentType;
  headers: Record<string, string>;
  attachments: ParsedEmailAttachment[];
};

/** 粗判 content 是否仍为未解码 RFC822（旧同步数据）。 */
export function looksLikeRawMime(source: string): boolean {
  const head = source.slice(0, 8192);
  return (
    (/^MIME-Version:/im.test(head) ||
      /^Content-Transfer-Encoding:/im.test(head) ||
      /^Content-Type:\s*multipart\//im.test(head)) &&
    /\r?\n\r?\n/.test(head)
  );
}

/**
 * 粗判解码后正文是否为 HTML（旧数据可能缺 content_type，或被默认成 text/plain）。
 * 故意偏保守：要求常见邮件 HTML 壳或足够多的标签。
 */
export function looksLikeHtmlContent(source: string): boolean {
  const s = source.trimStart();
  if (!s || looksLikeRawMime(s)) return false;
  if (/^<!DOCTYPE\s+html\b/i.test(s) || /^<html[\s>]/i.test(s)) return true;
  if (/^<(?:div|table|center|body|span|p|style|section|article|main)\b/i.test(s)) return true;
  const head = s.slice(0, 4000);
  const tags = head.match(/<\/?[a-z][a-z0-9]*\b/gi);
  return (tags?.length ?? 0) >= 3;
}

function headerValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((v) => headerValue(v) ?? String(v)).join(", ");
  }
  if (typeof value === "object" && value !== null && "text" in value) {
    const text = (value as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return coerceString(value);
}

function flattenAddresses(addr: AddressObject | AddressObject[] | undefined): string | undefined {
  if (!addr) return undefined;
  const list = Array.isArray(addr) ? addr : [addr];
  const parts = list
    .flatMap((item) => item.value ?? [])
    .map((v) => {
      if (v.name) return `${v.name} <${v.address ?? ""}>`;
      return v.address ?? "";
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function collectHeaders(parsed: ParsedMail): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of parsed.headers) {
    const rendered = headerValue(value);
    if (rendered != null && rendered !== "") out[key.toLowerCase()] = rendered;
  }
  const from = flattenAddresses(parsed.from);
  const to = flattenAddresses(parsed.to);
  const cc = flattenAddresses(parsed.cc);
  if (from && out.from == null) out.from = from;
  if (to && out.to == null) out.to = to;
  if (cc && out.cc == null) out.cc = cc;
  if (parsed.subject && out.subject == null) out.subject = parsed.subject;
  if (parsed.messageId && out["message-id"] == null) out["message-id"] = parsed.messageId;
  if (parsed.date && out.date == null) out.date = parsed.date.toISOString();
  return out;
}

function pickBodies(parsed: ParsedMail): {
  text: string;
  html: string | null;
  content: string;
  content_type: EmailContentType;
} {
  const html = typeof parsed.html === "string" && parsed.html.trim() ? parsed.html : null;
  const plain = typeof parsed.text === "string" ? parsed.text : "";
  if (html) {
    return {
      text: plain.trim()
        ? plain
        : html
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
      html,
      content: html,
      content_type: "text/html",
    };
  }
  if (plain.trim()) {
    return { text: plain, html: null, content: plain, content_type: "text/plain" };
  }
  return { text: "", html: null, content: "", content_type: "text/plain" };
}

function mapAttachments(parsed: ParsedMail): ParsedEmailAttachment[] {
  const list = parsed.attachments ?? [];
  return list.map((att, index) => {
    const filename =
      (typeof att.filename === "string" && att.filename.trim()) ||
      `attachment-${index + 1}${att.contentType?.includes("image/") ? ".bin" : ""}`;
    const content = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content ?? "");
    return {
      filename,
      content_type: att.contentType || "application/octet-stream",
      size: att.size ?? content.byteLength,
      content,
      ...(att.contentId ? { content_id: att.contentId } : {}),
      ...(att.contentDisposition ? { content_disposition: att.contentDisposition } : {}),
    };
  });
}

/** 解析 RFC822：CTE/charset 解码 + 附件分离；content 为正文 raw（优先 html）。 */
export async function parseEmailMime(source: string | Buffer): Promise<ParsedEmailMime> {
  const buf = typeof source === "string" ? Buffer.from(source, "utf-8") : source;
  const parsed = await simpleParser(buf);
  const bodies = pickBodies(parsed);
  return {
    ...bodies,
    headers: collectHeaders(parsed),
    attachments: mapAttachments(parsed),
  };
}

export async function decodeEmailBodyText(source: string | Buffer): Promise<string> {
  const parsed = await parseEmailMime(source);
  return parsed.text;
}

type MessageBodyFields = {
  body: string;
  text?: string | null;
  content_type?: EmailContentType | null;
};

/**
 * ToolSet / RPC 正文：
 * - 默认：纯文本（body.text；旧数据从 MIME 或 content 推导）
 * - raw=true：返回 content raw（html 或 plain，已 CTE 解码、已剥头/附件）
 */
export async function resolveEmailBodyForRead(
  message: MessageBodyFields,
  opts: { raw?: boolean } = {},
): Promise<string> {
  if (opts.raw) {
    if (looksLikeRawMime(message.body)) {
      const parsed = await parseEmailMime(message.body);
      return parsed.content;
    }
    return message.body;
  }

  if (message.text != null && message.text !== "") return message.text;
  if (looksLikeRawMime(message.body)) {
    return decodeEmailBodyText(message.body);
  }
  // html content 且无 text 字段时粗抽文本（含旧数据误标 plain）
  if (message.content_type === "text/html" || looksLikeHtmlContent(message.body)) {
    return message.body
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return message.body;
}

export async function resolveEmailContentType(
  message: MessageBodyFields,
): Promise<EmailContentType> {
  if (message.content_type === "text/html") return "text/html";
  // 显式 plain 且正文不像 HTML 时尊重；否则允许嗅探（旧同步缺字段 / 误标 plain）
  if (message.content_type === "text/plain" && !looksLikeHtmlContent(message.body)) {
    return "text/plain";
  }
  if (looksLikeHtmlContent(message.body)) return "text/html";

  if (looksLikeRawMime(message.body)) {
    const parsed = await parseEmailMime(message.body);
    return parsed.content_type;
  }
  return "text/plain";
}

/** 不在 headers 中重复实体已有的常用元信息 */
const HEADER_OMIT = new Set(["from", "to", "cc", "bcc", "subject", "date"]);

export function publicEmailHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (HEADER_OMIT.has(key.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
}

/** 读取侧解析 headers：优先已存字段，否则从旧版整封 body 解析。 */
export async function resolveEmailHeadersForRead(message: {
  body: string;
  headers?: Record<string, string> | null;
}): Promise<Record<string, string>> {
  if (message.headers && Object.keys(message.headers).length > 0) {
    return publicEmailHeaders(message.headers);
  }
  if (!looksLikeRawMime(message.body)) return {};
  const parsed = await parseEmailMime(message.body);
  return publicEmailHeaders(parsed.headers);
}
