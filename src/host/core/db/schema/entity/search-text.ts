import { EMAIL_MESSAGE_COMPONENT } from "./components/email-message.ts";

export function entitySearchTextForWrite(input: {
  title: string;
  summary: string;
  content: string;
  body: Record<string, unknown>;
  primary_component: string | null;
}): string {
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
