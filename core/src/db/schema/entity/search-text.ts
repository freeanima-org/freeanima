import { TASK_ITEM_COMPONENT } from "./components/task-item.ts";

export function entitySearchTextForWrite(input: {
  title: string;
  summary: string;
  content: string;
  body: Record<string, unknown>;
  primary_component: string;
}): string {
  const parts = [input.title, input.summary, input.content].map((s) => s.trim()).filter(Boolean);
  if (input.primary_component === TASK_ITEM_COMPONENT) {
    const tags = input.body.tags;
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (typeof tag === "string" && tag.trim()) parts.push(tag.trim());
      }
    }
  }
  return parts.join("\n");
}
