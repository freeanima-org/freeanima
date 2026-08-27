import { isRecord } from "@freeanima/shared/util";

import { EMAIL_MESSAGE_COMPONENT } from "./components/email-message.ts";
import { VAULT_ITEM_COMPONENT } from "./components/vault-item.ts";

export type EntitySearchTextInput = {
  title: string;
  summary: string;
  content: string;
  body: Record<string, unknown>;
  primary_component: string | null;
};

/** vault_item body 中参与检索的明文（url / uris / username） */
export function vaultItemSearchPartsFromBody(body: Record<string, unknown>): string[] {
  const parts: string[] = [];
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (username) parts.push(username);
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (url) parts.push(url);
  const uris = body.uris;
  if (Array.isArray(uris)) {
    for (const entry of uris) {
      if (!isRecord(entry)) continue;
      const uri = typeof entry.uri === "string" ? entry.uri.trim() : "";
      if (uri && uri !== url) parts.push(uri);
    }
  }
  return parts;
}

export function entitySearchTextForWrite(input: EntitySearchTextInput): string {
  const parts = [input.title, input.summary, input.content].map((s) => s.trim()).filter(Boolean);
  // 标签一律走顶层 entities.tag_ids（过滤用）；不再从 body.tags 写入 FTS
  if (input.primary_component === EMAIL_MESSAGE_COMPONENT) {
    const from = input.body.from;
    const to = input.body.to;
    if (typeof from === "string" && from.trim()) parts.push(from.trim());
    if (typeof to === "string" && to.trim()) parts.push(to.trim());
  }
  if (input.primary_component === VAULT_ITEM_COMPONENT) {
    parts.push(...vaultItemSearchPartsFromBody(input.body));
  }
  return parts.join("\n");
}

/** 检索索引文本（FTS / embedding）是否相对现态变化；元数据-only body 变更应返回 false */
export function entitySearchIndexTextChanged(
  prev: EntitySearchTextInput,
  next: EntitySearchTextInput,
): boolean {
  return entitySearchTextForWrite(prev) !== entitySearchTextForWrite(next);
}
