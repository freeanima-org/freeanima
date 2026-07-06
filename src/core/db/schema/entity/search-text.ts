import { DIARY_ENTRY_COMPONENT } from "./components/diary-entry.ts";
import { EMAIL_MESSAGE_COMPONENT } from "./components/email-message.ts";
import { EMAIL_THREAD_COMPONENT } from "./components/email-thread.ts";
import { TASK_ITEM_COMPONENT } from "./components/task-item.ts";

function appendTags(parts: string[], tags: unknown): void {
  if (!Array.isArray(tags)) return;
  for (const tag of tags) {
    if (typeof tag === "string" && tag.trim()) parts.push(tag.trim());
  }
}

export function entitySearchTextForWrite(input: {
  title: string;
  summary: string;
  content: string;
  body: Record<string, unknown>;
  primary_component: string;
}): string {
  const parts = [input.title, input.summary, input.content].map((s) => s.trim()).filter(Boolean);
  if (
    input.primary_component === TASK_ITEM_COMPONENT ||
    input.primary_component === DIARY_ENTRY_COMPONENT ||
    input.primary_component === EMAIL_MESSAGE_COMPONENT ||
    input.primary_component === EMAIL_THREAD_COMPONENT
  ) {
    appendTags(parts, input.body.tags);
  }
  if (input.primary_component === EMAIL_MESSAGE_COMPONENT) {
    const from = input.body.from;
    const to = input.body.to;
    if (typeof from === "string" && from.trim()) parts.push(from.trim());
    if (typeof to === "string" && to.trim()) parts.push(to.trim());
  }
  return parts.join("\n");
}
