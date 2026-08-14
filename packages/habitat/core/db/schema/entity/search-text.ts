import { EMAIL_MESSAGE_COMPONENT } from "./components/email-message.ts";

export type EntitySearchTextInput = {
  title: string;
  summary: string;
  content: string;
  body: Record<string, unknown>;
  primary_component: string | null;
};

export function entitySearchTextForWrite(input: EntitySearchTextInput): string {
  const parts = [input.title, input.summary, input.content].map((s) => s.trim()).filter(Boolean);
  // 标签一律走顶层 entities.tag_ids（过滤用）；不再从 body.tags 写入 FTS
  if (input.primary_component === EMAIL_MESSAGE_COMPONENT) {
    const from = input.body.from;
    const to = input.body.to;
    if (typeof from === "string" && from.trim()) parts.push(from.trim());
    if (typeof to === "string" && to.trim()) parts.push(to.trim());
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
